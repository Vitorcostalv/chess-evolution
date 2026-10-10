import { describe, it, expect } from "vitest";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { personalExamples } from "@/ai/self-play/personal";
import type { StoredGame } from "@/types/domain";
const chess = new Chess();
["f3", "e5", "g4", "Qh4#"].forEach((m) => chess.move(m));
const game: StoredGame = {
  id: "test",
  name: "Consent fixture",
  initialFen: DEFAULT_POSITION,
  pgn: chess.pgn(),
  createdAt: new Date().toISOString(),
  mode: "human",
  result: { result: "0-1", reason: "Xeque-mate" },
  white: "Human",
  black: "Engine",
  timeControl: "600",
  personalLearning: false,
};
describe("opt-in personal learning", () => {
  it("does not ingest games without consent", () =>
    expect(personalExamples(game)).toEqual([]));
  it("uses only the consenting human's causal positions and final outcome", () => {
    const examples = personalExamples({ ...game, personalLearning: true }, "w");
    expect(examples).toHaveLength(2);
    expect(examples[0].fen).toBe(DEFAULT_POSITION);
    expect(
      examples.every(
        (e) =>
          e.value === -1 &&
          e.color === "w" &&
          e.origin === "human-consented" &&
          e.policy.length === 1,
      ),
    ).toBe(true);
  });
  it("does not label unfinished or imported games", () => {
    expect(
      personalExamples({ ...game, personalLearning: true, result: null }),
    ).toEqual([]);
    expect(
      personalExamples({ ...game, personalLearning: true, mode: "import" }),
    ).toEqual([]);
  });
});
