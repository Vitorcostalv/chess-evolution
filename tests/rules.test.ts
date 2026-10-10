import { describe, it, expect } from "vitest";
import { Chess, DEFAULT_POSITION } from "chess.js";
import {
  gameResult,
  makeMove,
  loadGame,
  repetitionCount,
} from "@/engine/chess/rules";
describe("authoritative chess rules", () => {
  it("rejects illegal moves without changing the position", () => {
    const c = new Chess();
    expect(() => makeMove(c, { from: "e2", to: "e5" })).toThrow();
    expect(c.fen()).toBe(DEFAULT_POSITION);
  });
  it("plays a complete checkmate game", () => {
    const c = new Chess();
    ["f3", "e5", "g4", "Qh4#"].forEach((m) => c.move(m));
    expect(gameResult(c)).toEqual({ result: "0-1", reason: "Xeque-mate" });
    expect(() => makeMove(c, { from: "a2", to: "a3" })).toThrow();
  });
  it("supports castling with rook movement", () => {
    const c = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    c.move("O-O");
    expect(c.get("f1")?.type).toBe("r");
    expect(c.get("g1")?.type).toBe("k");
  });
  it("prevents castling through check", () => {
    const c = new Chess("r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1");
    expect(c.moves()).not.toContain("O-O");
  });
  it("captures en passant and restores it on undo", () => {
    const c = new Chess();
    ["e4", "a6", "e5", "d5"].forEach((m) => c.move(m));
    const before = c.fen();
    c.move("exd6");
    expect(c.get("d5")).toBeUndefined();
    c.undo();
    expect(c.fen()).toBe(before);
  });
  it.each(["q", "r", "b", "n"] as const)(
    "supports promotion to %s",
    (promotion) => {
      const c = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
      c.move({ from: "a7", to: "a8", promotion });
      expect(c.get("a8")?.type).toBe(promotion);
    },
  );
  it("detects stalemate", () =>
    expect(
      gameResult(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))?.reason,
    ).toBe("Afogamento"));
  it("detects material draw", () =>
    expect(gameResult(new Chess("7k/8/8/8/8/8/8/7K w - - 0 1"))?.reason).toBe(
      "Material insuficiente",
    ));
  it("detects repetition with history", () => {
    const c = new Chess();
    ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"].forEach((m) =>
      c.move(m),
    );
    expect(repetitionCount(c)).toBe(3);
    expect(gameResult(c)?.reason).toBe("Repetição de posição");
  });
  it("supports 50 and 75 move thresholds", () => {
    expect(
      gameResult(new Chess("7k/8/8/8/8/8/R7/7K w - - 100 51"))?.reason,
    ).toBe("Regra dos 50 movimentos");
    expect(
      gameResult(new Chess("7k/8/8/8/8/8/R7/7K w - - 150 76"))?.reason,
    ).toBe("Regra dos 75 movimentos");
  });
  it("round trips FEN and PGN including setup positions", () => {
    const c = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    c.move("a8=Q+");
    expect(loadGame(DEFAULT_POSITION, c.pgn()).fen()).toBe(c.fen());
  });
});
