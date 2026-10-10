import { describe, it, expect } from "vitest";
import * as tf from "@/ai/neural/tensorflow";
import { Chess } from "chess.js";
import {
  initializeBackend,
  createNetwork,
  infer,
  trainBatch,
  exportCheckpoint,
  restoreCheckpoint,
} from "@/ai/neural/network";
import { moveToAction } from "@/ai/encoding/actions";
import type { TrainingExample } from "@/types/domain";
describe("actual TensorFlow gradients and checkpoints", () => {
  it("updates weights, restores policy/value and continues Adam without tensor leaks", async () => {
    await initializeBackend("cpu");
    const baseline = tf.memory().numTensors,
      model = createNetwork("tiny"),
      c = new Chess(),
      action = moveToAction({ from: "e2", to: "e4" }, "w");
    const samples: TrainingExample[] = [0, 1].map((i) => ({
      id: String(i),
      gameId: "test-game",
      fen: c.fen(),
      policy: [[action, 1]],
      value: 1,
      color: "w",
      ply: 0,
      origin: "selfplay",
      repetition: 1,
    }));
    const before = await exportCheckpoint(model, {
      preset: "tiny",
      generation: 0,
      learningRate: 0.001,
      completedBatches: 0,
    });
    const loss = await trainBatch(model, samples);
    expect(loss.policyLoss).toBeGreaterThan(0);
    expect(loss.valueLoss).toBeGreaterThan(0);
    expect(Number.isFinite(loss.loss)).toBe(true);
    const after = await exportCheckpoint(model, {
      preset: "tiny",
      generation: 1,
      learningRate: 0.001,
      completedBatches: 1,
    });
    expect(after.hash).not.toBe(before.hash);
    expect(
      after.weights.some((w, i) =>
        w.values.some((v, j) => v !== before.weights[i].values[j]),
      ),
    ).toBe(true);
    const restored = await restoreCheckpoint(after);
    expect(infer(restored, c).value).toBeCloseTo(infer(model, c).value, 6);
    const a = await trainBatch(model, samples),
      b = await trainBatch(restored, samples);
    expect(a.loss).toBeCloseTo(b.loss, 5);
    expect(infer(restored, c).value).toBeCloseTo(infer(model, c).value, 5);
    const stable = tf.memory().numTensors;
    for (let i = 0; i < 8; i++) infer(restored, c);
    expect(tf.memory().numTensors).toBe(stable);
    model.optimizer.dispose();
    restored.optimizer.dispose();
    model.dispose();
    restored.dispose();
    expect(tf.memory().numTensors).toBeLessThanOrEqual(baseline + 2);
  });
  it("detects tampered checkpoint weights", async () => {
    await initializeBackend("cpu");
    const model = createNetwork("tiny"),
      checkpoint = await exportCheckpoint(model, {
        preset: "tiny",
        generation: 0,
        learningRate: 0.001,
        completedBatches: 0,
      });
    checkpoint.weights[0].values[0] += 0.1;
    await expect(restoreCheckpoint(checkpoint)).rejects.toThrow(
      "hash mismatch",
    );
    model.optimizer.dispose();
    model.dispose();
  });
});
