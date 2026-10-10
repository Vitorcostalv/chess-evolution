import { checkpointHash } from "@/ai/neural/network";
import type { ModelRecord } from "@/types/domain";
export async function createCandidate(
  parent: ModelRecord,
  learningRate: number,
): Promise<ModelRecord> {
  const { hash: oldHash, ...old } = structuredClone(parent.checkpoint);
  void oldHash;
  const content = {
    ...old,
    generation: parent.generation + 1,
    learningRate,
    optimizer: [],
  };
  return {
    ...parent,
    id: crypto.randomUUID(),
    name: `${parent.name.split(" · g")[0]} · g${content.generation}`,
    generation: content.generation,
    parentId: parent.id,
    createdAt: new Date().toISOString(),
    checkpoint: { ...content, hash: await checkpointHash(content) },
    status: "candidate",
    evaluations: [],
    origin: "Candidata por self-play local",
  };
}
