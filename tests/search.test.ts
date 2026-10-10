import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { negamaxSearch } from "@/engine/search/negamax";
import { mctsSearch } from "@/engine/search/mcts";
import { zobrist } from "@/engine/hashing/zobrist";
import { evaluatePromotion } from "@/ai/evaluation/promotion";
const config = {
  algorithm: "negamax" as const,
  depth: 2,
  timeMs: 3000,
  simulations: 32,
  seed: 42,
};
describe("real bounded searches", () => {
  it("finds mate in one and leaves the game unchanged", () => {
    const c = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"),
      fen = c.fen(),
      r = negamaxSearch(c, config);
    expect(c.fen()).toBe(fen);
    c.move(r.move!);
    expect(c.isCheckmate()).toBe(true);
    expect(r.score).toBeGreaterThan(99000);
  });
  it("returns only a legal heuristic move with measured nodes", () => {
    const c = new Chess(),
      fen = c.fen(),
      r = negamaxSearch(c, { ...config, timeMs: 150 });
    expect(r.nodes).toBeGreaterThan(0);
    expect(() => c.move(r.move!)).not.toThrow();
    c.undo();
    expect(c.fen()).toBe(fen);
    expect(r.timeMs).toBeLessThan(700);
  });
  it("cancels without leaking moves", () => {
    const c = new Chess(),
      fen = c.fen();
    expect(() => negamaxSearch(c, config, () => true)).toThrow(
      "SEARCH_CANCELLED",
    );
    expect(c.fen()).toBe(fen);
  });
  it("backs up MCTS values with correct signs and normalized visits", () => {
    const c = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"),
      fen = c.fen();
    const r = mctsSearch(
      c,
      { ...config, simulations: 128, timeMs: 5000 },
      () => ({ value: 0 }),
    );
    expect(c.fen()).toBe(fen);
    expect(r.policy!.reduce((a, p) => a + p[1], 0)).toBeCloseTo(1);
    c.move(r.move!);
    expect(c.isCheckmate()).toBe(true);
  });
  it("refuses non-finite neural predictions", () =>
    expect(() =>
      mctsSearch(new Chess(), config, () => ({ value: NaN })),
    ).toThrow());
  it("returns a terminal result instead of inventing moves", () => {
    const c = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(negamaxSearch(c, config).move).toBeNull();
    expect(mctsSearch(c, config).move).toBeNull();
  });
  it("hash includes side, castling and en-passant context", () => {
    const fen = new Chess().fen();
    expect(zobrist(fen)).toBe(zobrist(fen));
    expect(zobrist(fen.replace(" w ", " b "))).not.toBe(zobrist(fen));
    expect(zobrist(fen.replace("KQkq", "-"))).not.toBe(zobrist(fen));
  });
  it("never promotes an inferior, tied or undersampled candidate", () => {
    expect(evaluatePromotion(0, 0, 8).promoted).toBe(false);
    expect(evaluatePromotion(0, 8, 0).promoted).toBe(false);
    expect(evaluatePromotion(4, 0, 0).promoted).toBe(false);
    expect(evaluatePromotion(8, 0, 0).promoted).toBe(true);
  });
});
