import { Chess, DEFAULT_POSITION, type Square } from "chess.js";
import type { GameResult, MoveInput } from "@/types/domain";
export { DEFAULT_POSITION };
export function loadGame(fen = DEFAULT_POSITION, pgn?: string) {
  const chess = new Chess(fen);
  if (pgn?.trim()) chess.loadPgn(pgn, { strict: true });
  return chess;
}
export function gameResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate())
    return {
      result: chess.turn() === "w" ? "0-1" : "1-0",
      reason: "Xeque-mate",
    };
  if (Number(chess.fen().split(" ")[4]) >= 150)
    return { result: "1/2-1/2", reason: "Regra dos 75 movimentos" };
  if (chess.isStalemate()) return { result: "1/2-1/2", reason: "Afogamento" };
  if (chess.isInsufficientMaterial())
    return { result: "1/2-1/2", reason: "Material insuficiente" };
  if (chess.isThreefoldRepetition())
    return { result: "1/2-1/2", reason: "Repetição de posição" };
  if (chess.isDrawByFiftyMoves())
    return { result: "1/2-1/2", reason: "Regra dos 50 movimentos" };
  return null;
}
export function legalMoves(chess: Chess, square?: Square) {
  return chess.moves({ verbose: true, ...(square ? { square } : {}) });
}
export function makeMove(chess: Chess, input: MoveInput) {
  if (gameResult(chess)) throw new Error("A partida já terminou.");
  return chess.move(input);
}
export function repetitionCount(chess: Chess) {
  const key = chess.fen().split(" ").slice(0, 4).join(" ");
  return (
    1 +
    chess
      .history({ verbose: true })
      .filter((m) => m.before.split(" ").slice(0, 4).join(" ") === key).length
  );
}
export function winner(result: GameResult): "w" | "b" | null {
  return result.result === "1-0" ? "w" : result.result === "0-1" ? "b" : null;
}
