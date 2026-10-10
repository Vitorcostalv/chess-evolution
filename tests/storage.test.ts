import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { storage, database } from "@/services/storage/database";
import { playGeneratedGame } from "@/ai/self-play/game";
import { DEFAULT_PREFERENCES } from "@/types/domain";
describe("bounded real self-play and IndexedDB", () => {
  it("generates legal PGN, real positions and an explicit budget adjudication", async () => {
    const { game, examples } = await playGeneratedGame({
      white: () => ({ value: 0 }),
      black: () => ({ value: 0 }),
      simulations: 4,
      maxPlies: 8,
      seed: 42,
      mode: "selfplay",
      beforeMove: async () => {},
      whiteName: "Test white",
      blackName: "Test black",
    });
    expect(examples).toHaveLength(8);
    expect(game.pgn).toContain("1.");
    expect(game.result?.reason).toContain("adjudicado");
    expect(examples.every((e) => e.policy.length > 0 && e.value === 0)).toBe(
      true,
    );
    await storage.saveGame(game);
    expect((await storage.games()).some((g) => g.id === game.id)).toBe(true);
    await storage.addReplay(examples, 4);
    expect(await storage.replay()).toHaveLength(4);
    await storage.deleteGame(game.id);
    expect(await storage.games()).toHaveLength(0);
  });
  it("persists preferences across connections", async () => {
    await storage.savePreferences({ ...DEFAULT_PREFERENCES, graphics: "low" });
    expect((await storage.preferences())?.graphics).toBe("low");
    expect((await database()).version).toBe(4);
  });
  it("rejects promotion without recorded evidence", async () => {
    await expect(storage.promote("missing", null)).rejects.toThrow("avaliação");
  });
});
