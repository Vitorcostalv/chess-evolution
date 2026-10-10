import { Chess, type PieceSymbol } from "chess.js";
const MATERIAL: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 0,
};
export const HEURISTIC_WEIGHTS = {
  material: 1,
  center: 1,
  pawns: 1,
  king: 1,
  mobility: 1,
};
export function evaluateWhite(
  chess: Chess,
  weights = HEURISTIC_WEIGHTS,
): number {
  let score = 0,
    nonPawnMaterial = 0;
  const pawns: { w: number[]; b: number[] } = {
    w: Array(8).fill(0),
    b: Array(8).fill(0),
  };
  const board = chess.board();
  for (let row = 0; row < 8; row++)
    for (let file = 0; file < 8; file++) {
      const p = board[row][file];
      if (!p) continue;
      const sign = p.color === "w" ? 1 : -1,
        rank = p.color === "w" ? 7 - row : row;
      const central = 3.5 - Math.max(Math.abs(file - 3.5), Math.abs(row - 3.5));
      let positional = 0;
      if (p.type === "p") {
        pawns[p.color][file]++;
        positional = rank * 7 + central * 5;
      }
      if (p.type === "n") positional = central * 22 - (rank === 0 ? 15 : 0);
      if (p.type === "b") positional = central * 12 + (rank > 0 ? 8 : 0);
      if (p.type === "r") positional = rank === 6 ? 25 : rank * 2;
      if (p.type === "q")
        positional =
          central * 5 - (rank > 2 && chess.moveNumber() < 8 ? 18 : 0);
      score +=
        sign *
        (MATERIAL[p.type] * weights.material + positional * weights.center);
      if (!["p", "k"].includes(p.type)) nonPawnMaterial += MATERIAL[p.type];
    }
  for (const color of ["w", "b"] as const)
    for (let f = 0; f < 8; f++) {
      const count = pawns[color][f],
        sign = color === "w" ? 1 : -1;
      if (count > 1) score -= sign * (count - 1) * 15 * weights.pawns;
      if (count && !(pawns[color][f - 1] ?? 0) && !(pawns[color][f + 1] ?? 0))
        score -= sign * 12 * weights.pawns;
    }
  for (let row = 0; row < 8; row++)
    for (let file = 0; file < 8; file++) {
      const p = board[row][file];
      if (p?.type !== "k") continue;
      const sign = p.color === "w" ? 1 : -1,
        rank = p.color === "w" ? 7 - row : row;
      const center = 3.5 - Math.max(Math.abs(file - 3.5), Math.abs(row - 3.5));
      score +=
        sign *
        (nonPawnMaterial < 1600
          ? center * 25
          : rank === 0 && (file === 2 || file === 6)
            ? 35
            : -rank * 18) *
        weights.king;
    }
  const mobility = chess.moves().length;
  score +=
    (chess.turn() === "w" ? 1 : -1) *
    Math.min(mobility, 40) *
    2 *
    weights.mobility;
  return Math.round(score);
}
export function heuristicValue(chess: Chess) {
  return Math.tanh(
    (evaluateWhite(chess) * (chess.turn() === "w" ? 1 : -1)) / 600,
  );
}
