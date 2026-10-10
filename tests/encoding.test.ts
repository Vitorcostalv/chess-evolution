import { describe, it, expect } from "vitest";
import { Chess, type Square } from "chess.js";
import {
  encodeBoard,
  squareCoordinates,
  coordinatesSquare,
  ACTION_SPACE,
} from "@/ai/encoding/board";
import { moveToAction, actionToMove, legalPolicy } from "@/ai/encoding/actions";
describe("reversible policy and deterministic encoder", () => {
  it("encodes 20 finite channels deterministically", () => {
    const c = new Chess();
    expect(encodeBoard(c)).toHaveLength(1280);
    expect(encodeBoard(c)).toEqual(encodeBoard(c));
    expect(Array.from(encodeBoard(c)).every(Number.isFinite)).toBe(true);
  });
  it("inverts every board coordinate in both perspectives", () => {
    for (const turn of ["w", "b"] as const)
      for (const f of "abcdefgh")
        for (let r = 1; r <= 8; r++) {
          const square = `${f}${r}` as Square;
          expect(
            coordinatesSquare(...squareCoordinates(square, turn), turn),
          ).toBe(square);
        }
  });
  it.each([
    new Chess().fen(),
    "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1",
    "7k/P7/8/8/8/8/8/7K w - - 0 1",
    "7k/8/8/8/8/8/p7/7K b - - 0 1",
    "1r5k/P7/8/8/8/8/8/7K w - - 0 1",
  ])("round trips all legal actions in %s", (fen) => {
    const c = new Chess(fen),
      moves = c.moves({ verbose: true }),
      actions = moves.map((m) => moveToAction(m, c.turn()));
    expect(new Set(actions).size).toBe(moves.length);
    moves.forEach((m) =>
      expect(actionToMove(moveToAction(m, c.turn()), c)).toEqual({
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      }),
    );
  });
  it("masks illegal policy logits and handles malformed values", () => {
    const c = new Chess(),
      policy = new Float32Array(ACTION_SPACE).fill(1);
    policy[moveToAction(c.moves({ verbose: true })[0], "w")] = Infinity;
    const legal = legalPolicy(policy, c.moves({ verbose: true }), "w");
    expect(legal).toHaveLength(20);
    expect(legal.reduce((a, b) => a + b.probability, 0)).toBeCloseTo(1, 6);
    expect(legal.every((p) => Number.isFinite(p.probability))).toBe(true);
  });
  it("covers sampled reachable states and promotions without collisions", () => {
    const c = new Chess();
    for (let i = 0; i < 80 && !c.isGameOver(); i++) {
      const moves = c.moves({ verbose: true });
      const ids = moves.map((m) => moveToAction(m, c.turn()));
      expect(new Set(ids).size).toBe(moves.length);
      for (const m of moves)
        expect(actionToMove(moveToAction(m, c.turn()), c).to).toBe(m.to);
      c.move(moves[(i * 17 + 3) % moves.length]);
    }
  });
  it("rejects actions outside policy bounds", () => {
    expect(() => actionToMove(-1, new Chess())).toThrow();
    expect(() => actionToMove(4672, new Chess())).toThrow();
  });
});
