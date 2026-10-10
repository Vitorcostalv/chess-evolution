import { z } from "zod";
import { Chess } from "chess.js";
import {
  assertOrigin,
  rateLimit,
  owner,
  remoteDb,
  body,
  failure,
  RemoteError,
} from "@/services/remote/security";
const gameSchema = z.object({
  id: z.uuid(),
  name: z.string().max(120),
  pgn: z.string().max(64000),
  initialFen: z.string().max(150),
  createdAt: z.iso.datetime(),
  mode: z.enum(["human", "ai", "selfplay", "evaluation", "import"]),
  result: z
    .object({
      result: z.enum(["1-0", "0-1", "1/2-1/2"]),
      reason: z.string().max(150),
    })
    .nullable(),
  white: z.string().max(80),
  black: z.string().max(80),
  timeControl: z.string().max(80),
  personalLearning: z.boolean(),
});
const metadataSchema = z.object({
  id: z.uuid(),
  name: z.string().max(64),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  generation: z.number().int().min(0).max(1000000),
  completedBatches: z.number().int().min(0).max(1000000),
  preset: z.enum(["tiny", "standard", "research"]),
});
export async function GET(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request);
    const ownerId = await owner(),
      db = remoteDb();
    const [games, models] = await Promise.all([
      db.remoteGame.findMany({
        where: { ownerId },
        take: 200,
        orderBy: { updatedAt: "desc" },
      }),
      db.modelMetadata.findMany({ where: { ownerId }, take: 32 }),
    ]);
    return Response.json({
      games: games.map((g) => g.payload),
      models: models.map((m) => ({
        id: m.localId,
        name: m.name,
        hash: m.hash,
        generation: m.generation,
        completedBatches: m.completedBatches,
        preset: m.preset,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request);
    const ownerId = await owner(),
      payload = z
        .object({
          game: gameSchema.optional(),
          model: metadataSchema.optional(),
        })
        .parse(await body(request));
    if (!payload.game && !payload.model)
      throw new RemoteError(400, "Envie uma partida ou metadados.");
    const db = remoteDb();
    if (payload.game) {
      const g = payload.game,
        c = new Chess(g.initialFen);
      c.loadPgn(g.pgn, { strict: true });
      await db.$transaction(
        async (tx) => {
          const count = await tx.remoteGame.count({ where: { ownerId } }),
            exists = await tx.remoteGame.findUnique({
              where: { ownerId_localId: { ownerId, localId: g.id } },
            });
          if (count >= 200 && !exists)
            throw new RemoteError(409, "Limite remoto de 200 partidas.");
          await tx.remoteGame.upsert({
            where: { ownerId_localId: { ownerId, localId: g.id } },
            create: {
              id: crypto.randomUUID(),
              ownerId,
              localId: g.id,
              payload: g,
            },
            update: { payload: g },
          });
        },
        { isolationLevel: "Serializable" },
      );
    }
    if (payload.model) {
      const { id: localId, ...m } = payload.model;
      await db.$transaction(
        async (tx) => {
          const count = await tx.modelMetadata.count({ where: { ownerId } }),
            exists = await tx.modelMetadata.findUnique({
              where: { ownerId_localId: { ownerId, localId } },
            });
          if (count >= 32 && !exists)
            throw new RemoteError(409, "Limite remoto de 32 modelos.");
          await tx.modelMetadata.upsert({
            where: { ownerId_localId: { ownerId, localId } },
            create: { id: crypto.randomUUID(), ownerId, localId, ...m },
            update: m,
          });
        },
        { isolationLevel: "Serializable" },
      );
    }
    return Response.json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request);
    const ownerId = await owner(),
      db = remoteDb();
    await db.$transaction([
      db.remoteGame.deleteMany({ where: { ownerId } }),
      db.modelMetadata.deleteMany({ where: { ownerId } }),
    ]);
    return Response.json({ deleted: true });
  } catch (error) {
    return failure(error);
  }
}
