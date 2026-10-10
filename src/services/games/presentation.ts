import { Chess, type Square } from "chess.js";
import { loadGame } from "@/engine/chess/rules";
import { pieceInstances } from "./pieces";
export type VisualPiece = ReturnType<typeof pieceInstances>[number] & {
  exiting?: boolean;
  fromSquare?: Square;
};
export function transitionPieces(
  before: VisualPiece[],
  after: VisualPiece[],
): VisualPiece[] {
  const next = after.map((p) => ({
    ...p,
    fromSquare: before.find((old) => old.id === p.id)?.square ?? p.square,
  }));
  return [
    ...next,
    ...before
      .filter((p) => !after.some((n) => n.id === p.id))
      .map((p) => ({ ...p, exiting: true })),
  ];
}
export function replayPosition(initialFen: string, pgn: string, ply: number) {
  const original = loadGame(initialFen, pgn),
    moves = original.history({ verbose: true });
  const c = new Chess(initialFen);
  for (const move of moves.slice(0, Math.max(0, Math.min(ply, moves.length))))
    c.move({
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    });
  return { fen: c.fen(), pgn: c.pgn(), history: c.history() };
}
export function positionSummary(initialFen: string, pgn: string) {
  const c = loadGame(initialFen, pgn),
    pieces = c
      .board()
      .flat()
      .filter((p) => p !== null);
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const balance = pieces.reduce(
    (sum, p) => sum + values[p.type] * (p.color === "w" ? 1 : -1),
    0,
  );
  const captured = c
    .history({ verbose: true })
    .filter((m) => m.captured)
    .map((m) => ({
      type: m.captured!,
      color: m.color === "w" ? ("b" as const) : ("w" as const),
    }));
  const last = c.history({ verbose: true }).at(-1);
  return {
    balance,
    captured,
    last: last ? [last.from, last.to] : [],
    check: c.isCheck()
      ? pieces.find((p) => p.type === "k" && p.color === c.turn())?.square
      : undefined,
  };
}
