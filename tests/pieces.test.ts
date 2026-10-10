import { describe, it, expect } from "vitest";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { pieceInstances } from "@/services/games/pieces";
describe("stable 3D identities", () => {
  it("keeps identity during movement and removes captures", () => {
    const c = new Chess(),
      original = pieceInstances(DEFAULT_POSITION, "").find(
        (p) => p.square === "e2",
      )!;
    ["e4", "d5", "exd5"].forEach((m) => c.move(m));
    const pieces = pieceInstances(DEFAULT_POSITION, c.pgn());
    expect(pieces).toHaveLength(31);
    expect(pieces.find((p) => p.square === "d5")?.id).toBe(original.id);
  });
  it("moves both castling instances", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      c = new Chess(fen);
    c.move("O-O");
    const pieces = pieceInstances(fen, c.pgn());
    expect(pieces.find((p) => p.square === "f1")?.id).toContain(":h1");
    expect(pieces.find((p) => p.square === "g1")?.id).toContain(":e1");
  });
  it("removes the en-passant captured pawn", () => {
    const c = new Chess();
    ["e4", "a6", "e5", "d5", "exd6"].forEach((m) => c.move(m));
    const pieces = pieceInstances(DEFAULT_POSITION, c.pgn());
    expect(pieces).toHaveLength(31);
    expect(pieces.some((p) => p.square === "d5")).toBe(false);
  });
});
