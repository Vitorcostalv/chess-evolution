import * as tf from "./tensorflow";
import { Chess } from "chess.js";
import { repetitionCount } from "@/engine/chess/rules";
import { encodeBoard, CHANNELS, ACTION_SPACE } from "@/ai/encoding/board";
import type {
  Preset,
  Checkpoint,
  SerializedTensor,
  TrainingExample,
} from "@/types/domain";
export const PRESETS: Record<Preset, { filters: number; blocks: number }> = {
  tiny: { filters: 8, blocks: 1 },
  standard: { filters: 16, blocks: 2 },
  research: { filters: 24, blocks: 3 },
};
export async function initializeBackend(preference: "auto" | "cpu" = "auto") {
  if (preference === "auto" && typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(8, 8);
      if (canvas.getContext("webgl2") && (await tf.setBackend("webgl"))) {
        await tf.ready();
        const result = tf.tidy(() => {
          const gradient = tf.grad((x) =>
            tf
              .conv2d(
                x as tf.Tensor4D,
                tf.ones([1, 1, 1, 1]) as tf.Tensor4D,
                1,
                "same",
              )
              .sum(),
          );
          return gradient(tf.ones([1, 2, 2, 1])).dataSync()[0];
        });
        if (Number.isFinite(result)) return "webgl";
      }
    } catch {
      /* Worker WebGL/operator support varies; verified CPU is mandatory fallback. */
    }
  }
  await tf.setBackend("cpu");
  await tf.ready();
  return "cpu";
}
export function createNetwork(
  preset: Preset,
  learningRate = 0.001,
  seed = 42,
): tf.LayersModel {
  const { filters, blocks } = PRESETS[preset];
  const input = tf.input({ shape: [8, 8, CHANNELS] });
  const convolution = (
    channels: number,
    activation: "relu" | "linear" = "relu",
    kernelSize = 3,
  ) =>
    tf.layers.conv2d({
      filters: channels,
      kernelSize,
      padding: "same",
      activation,
      kernelInitializer: tf.initializers.glorotUniform({ seed: seed++ }),
      kernelRegularizer: tf.regularizers.l2({ l2: 0.00001 }),
    });
  let trunk = convolution(filters).apply(input) as tf.SymbolicTensor;
  for (let block = 0; block < blocks; block++) {
    const hidden = convolution(filters).apply(trunk) as tf.SymbolicTensor;
    const next = convolution(filters, "linear").apply(
      hidden,
    ) as tf.SymbolicTensor;
    trunk = tf.layers
      .activation({ activation: "relu" })
      .apply(tf.layers.add().apply([trunk, next])) as tf.SymbolicTensor;
  }
  const logits = convolution(73, "linear", 1).apply(trunk) as tf.SymbolicTensor;
  const policy = tf.layers
    .activation({ activation: "softmax", name: "policy" })
    .apply(
      tf.layers.reshape({ targetShape: [ACTION_SPACE] }).apply(logits),
    ) as tf.SymbolicTensor;
  const features = tf.layers.flatten().apply(trunk) as tf.SymbolicTensor;
  const hidden = tf.layers
    .dense({
      units: 32,
      activation: "relu",
      kernelInitializer: tf.initializers.glorotUniform({ seed: seed++ }),
    })
    .apply(features) as tf.SymbolicTensor;
  const value = tf.layers
    .dense({
      units: 1,
      activation: "tanh",
      name: "value",
      kernelInitializer: tf.initializers.glorotUniform({ seed }),
    })
    .apply(hidden) as tf.SymbolicTensor;
  const model = tf.model({ inputs: input, outputs: [policy, value] });
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: ["categoricalCrossentropy", "meanSquaredError"],
  });
  return model;
}
export function infer(
  model: tf.LayersModel,
  chess: Chess,
  repetition = repetitionCount(chess),
) {
  return tf.tidy(() => {
    const input = tf.tensor4d(encodeBoard(chess, repetition), [
      1,
      8,
      8,
      CHANNELS,
    ]);
    const [policy, value] = model.predict(input) as tf.Tensor[];
    return {
      policy: Array.from(policy.dataSync()),
      value: value.dataSync()[0],
    };
  });
}
function serializeTensor(tensor: tf.Tensor, name: string): SerializedTensor {
  if (tensor.dtype !== "float32" && tensor.dtype !== "int32")
    throw new Error("Unsupported tensor dtype");
  const values = Array.from(tensor.dataSync());
  if (values.some((v) => !Number.isFinite(v)))
    throw new Error("Checkpoint contains non-finite weights");
  return { name, shape: tensor.shape, dtype: tensor.dtype, values };
}
export async function checkpointHash(value: Omit<Checkpoint, "hash">) {
  const buffer = new TextEncoder().encode(JSON.stringify(value));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function exportCheckpoint(
  model: tf.LayersModel,
  meta: {
    preset: Preset;
    generation: number;
    learningRate: number;
    completedBatches: number;
  },
): Promise<Checkpoint> {
  const weights = model
    .getWeights()
    .map((tensor, i) => serializeTensor(tensor, model.weights[i].name));
  const named = await model.optimizer.getWeights();
  const optimizer = named.map((n) => serializeTensor(n.tensor, n.name));
  // Adam's iteration tensor is newly allocated; slot tensors belong to optimizer.
  named.filter((n) => n.name === "iter").forEach((n) => n.tensor.dispose());
  const content = {
    format: "chess-evolution-v1" as const,
    encoding: 1 as const,
    actionSpace: 4672 as const,
    ...meta,
    weights,
    optimizer,
  };
  return { ...content, hash: await checkpointHash(content) };
}
export async function restoreCheckpoint(
  checkpoint: Checkpoint,
): Promise<tf.LayersModel> {
  const { hash, ...content } = checkpoint;
  if ((await checkpointHash(content)) !== hash)
    throw new Error("Checkpoint hash mismatch");
  const model = createNetwork(checkpoint.preset, checkpoint.learningRate);
  const expected = model.getWeights();
  if (expected.length !== checkpoint.weights.length) {
    model.dispose();
    throw new Error("Incompatible weight count");
  }
  const tensors: tf.Tensor[] = [];
  try {
    for (let i = 0; i < expected.length; i++) {
      const w = checkpoint.weights[i];
      if (
        w.dtype !== expected[i].dtype ||
        w.shape.join(",") !== expected[i].shape.join(",") ||
        w.values.length !== expected[i].size ||
        w.values.some((v) => !Number.isFinite(v))
      )
        throw new Error("Incompatible tensor");
      tensors.push(tf.tensor(w.values, w.shape, w.dtype));
    }
    model.setWeights(tensors);
    if (checkpoint.optimizer?.length) {
      const states = checkpoint.optimizer.map((w) => ({
        name: w.name,
        tensor: tf.tensor(w.values, w.shape, w.dtype),
      }));
      try {
        await model.optimizer.setWeights(states);
      } finally {
        states.forEach((s) => s.tensor.dispose());
      }
    }
    return model;
  } catch (error) {
    model.dispose();
    throw error;
  } finally {
    tensors.forEach((t) => t.dispose());
  }
}
export function tensorsForExamples(examples: TrainingExample[]) {
  const inputs = new Float32Array(examples.length * 8 * 8 * CHANNELS),
    policies = new Float32Array(examples.length * ACTION_SPACE),
    values = new Float32Array(examples.length);
  examples.forEach((e, i) => {
    inputs.set(
      encodeBoard(new Chess(e.fen), e.repetition),
      i * 8 * 8 * CHANNELS,
    );
    for (const [action, p] of e.policy) policies[i * ACTION_SPACE + action] = p;
    values[i] = e.value;
  });
  return {
    x: tf.tensor4d(inputs, [examples.length, 8, 8, CHANNELS]),
    policy: tf.tensor2d(policies, [examples.length, ACTION_SPACE]),
    value: tf.tensor2d(values, [examples.length, 1]),
  };
}
export async function trainBatch(
  model: tf.LayersModel,
  examples: TrainingExample[],
) {
  const tensors = tensorsForExamples(examples);
  try {
    const measured = tf.tidy(() => {
      const [policy, value] = model.predict(tensors.x) as tf.Tensor[];
      return {
        policyLoss: tf
          .neg(
            tf.sum(
              tf.mul(tensors.policy, tf.log(tf.maximum(policy, 1e-7))),
              -1,
            ),
          )
          .mean()
          .dataSync()[0],
        valueLoss: tf
          .squaredDifference(tensors.value, value)
          .mean()
          .dataSync()[0],
      };
    });
    const losses = await model.trainOnBatch(tensors.x, [
      tensors.policy,
      tensors.value,
    ]);
    const list = typeof losses === "number" ? [losses] : losses;
    if (list.some((v) => !Number.isFinite(v)))
      throw new Error("Non-finite training loss; candidate cannot be used.");
    return { loss: list[0], ...measured };
  } finally {
    tensors.x.dispose();
    tensors.policy.dispose();
    tensors.value.dispose();
  }
}
export function validationLoss(
  model: tf.LayersModel,
  examples: TrainingExample[],
): number | null {
  if (!examples.length) return null;
  const t = tensorsForExamples(examples);
  try {
    const result = model.evaluate(t.x, [t.policy, t.value]);
    const out = Array.isArray(result) ? result : [result];
    const value = out[0].dataSync()[0];
    out.forEach((v) => v.dispose());
    return Number.isFinite(value) ? value : null;
  } finally {
    t.x.dispose();
    t.policy.dispose();
    t.value.dispose();
  }
}
export function tensorMemory() {
  const info = tf.memory();
  return {
    bytes: info.numBytes,
    tensors: info.numTensors,
    estimated: info.unreliable,
  };
}
