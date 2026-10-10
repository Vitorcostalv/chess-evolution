import { Chess, type Square, type Color, type PieceSymbol } from "chess.js";
import { loadGame } from "@/engine/chess/rules";
export function pieceInstances(initialFen: string, pgn: string) {
  const initial = new Chess(initialFen),
    pieces = new Map<Square, { id: string; type: PieceSymbol; color: Color }>();
  for (const row of initial.board())
    for (const p of row)
      if (p)
        pieces.set(p.square, {
          id: `${initialFen}:${p.square}`,
          type: p.type,
          color: p.color,
        });
  const game = loadGame(initialFen, pgn);
  for (const m of game.history({ verbose: true })) {
    const piece = pieces.get(m.from);
    pieces.delete(m.from);
    pieces.delete(m.to);
    if (m.flags.includes("e"))
      pieces.delete(`${m.to[0]}${m.from[1]}` as Square);
    if (piece) pieces.set(m.to, { ...piece, type: m.promotion ?? piece.type });
    if (m.flags.includes("k") || m.flags.includes("q")) {
      const rank = m.from[1],
        from = `${m.flags.includes("k") ? "h" : "a"}${rank}` as Square,
        to = `${m.flags.includes("k") ? "f" : "d"}${rank}` as Square,
        rook = pieces.get(from);
      pieces.delete(from);
      if (rook) pieces.set(to, rook);
    }
  }
  return [...pieces].map(([square, piece]) => ({ ...piece, square }));
}
