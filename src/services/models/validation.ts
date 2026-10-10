import { z } from "zod";
import { Chess } from "chess.js";
export const fenSchema = z
  .string()
  .max(256)
  .refine((value) => {
    try {
      new Chess(value);
      return true;
    } catch {
      return false;
    }
  }, "FEN inválida.");
const tensor = z
  .object({
    name: z.string().max(128),
    shape: z.array(z.number().int().min(0).max(100000)).max(4),
    dtype: z.enum(["float32", "int32"]),
    values: z.array(z.number().finite()).max(500000),
  })
  .refine(
    (t) => t.shape.reduce((n, v) => n * v, 1) === t.values.length,
    "Dimensões de tensor inválidas.",
  );
export const checkpointSchema = z
  .object({
    format: z.literal("chess-evolution-v1"),
    encoding: z.literal(1),
    actionSpace: z.literal(4672),
    preset: z.enum(["tiny", "standard", "research"]),
    generation: z.number().int().min(0).max(100000),
    weights: z.array(tensor).min(1).max(64),
    optimizer: z.array(tensor).max(130).optional(),
    learningRate: z.number().min(0.00001).max(0.05),
    completedBatches: z.number().int().min(0).max(10000000),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .refine(
    (c) =>
      [...c.weights, ...(c.optimizer ?? [])].reduce(
        (n, t) => n + t.values.length,
        0,
      ) <= 1000000,
    "Modelo excede o orçamento de memória.",
  );
export const evaluationSchema = z.object({
  id: z.string().max(100),
  opponent: z.string().max(100),
  games: z.number().int().min(0).max(1000),
  wins: z.number().int().min(0),
  draws: z.number().int().min(0),
  losses: z.number().int().min(0),
  points: z.number().min(0).max(1),
  lowerBound: z.number().min(0).max(1),
  eloDifference: z.number().finite().nullable(),
  promoted: z.boolean(),
  at: z.string().datetime(),
});
export const modelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(64),
  preset: z.enum(["tiny", "standard", "research"]),
  generation: z.number().int().min(0),
  createdAt: z.string().datetime(),
  origin: z.string().max(100),
  parentId: z.string().uuid().optional(),
  status: z.enum(["candidate", "champion", "archived"]),
  parameters: z.number().int().min(1).max(500000),
  completedBatches: z.number().int().min(0),
  checkpoint: checkpointSchema,
  evaluations: z.array(evaluationSchema).max(100),
});
export const trainingConfigSchema = z.object({
  games: z.number().int().min(1).max(8),
  simulations: z.number().int().min(4).max(128),
  maxPlies: z.number().int().min(8).max(240),
  epochs: z.number().int().min(1).max(20),
  batchSize: z.number().int().min(2).max(32),
  learningRate: z.number().min(0.00001).max(0.01),
  bufferCapacity: z.number().int().min(64).max(4096),
  checkpointEvery: z.number().int().min(1).max(10),
});
export function parseModel(content: string) {
  if (new TextEncoder().encode(content).length > 10 * 1024 * 1024)
    throw new Error("Arquivo de modelo maior que 10 MiB.");
  const parsed = modelSchema.parse(JSON.parse(content));
  if (
    parsed.preset !== parsed.checkpoint.preset ||
    parsed.generation !== parsed.checkpoint.generation ||
    parsed.completedBatches !== parsed.checkpoint.completedBatches
  )
    throw new Error("Manifesto e checkpoint incompatíveis.");
  return {
    ...parsed,
    status: "candidate" as const,
    evaluations: [],
    origin: "Importação local (não validada)",
  };
}
