import { type Color } from "chess.js";
import { loadGame, winner } from "@/engine/chess/rules";
import { moveToAction } from "@/ai/encoding/actions";
import type { StoredGame, TrainingExample } from "@/types/domain";
export function personalExamples(
  game: StoredGame,
  human?: Color,
): TrainingExample[] {
  if (!game.personalLearning || !game.result || game.mode !== "human")
    return [];
  const c = loadGame(game.initialFen, game.pgn),
    win = winner(game.result);
  return c
    .history({ verbose: true })
    .filter((m) => !human || m.color === human)
    .map((m, ply) => ({
      id: `${String(Date.parse(game.createdAt)).padStart(13, "0")}-${game.id}-human-${ply}`,
      gameId: game.id,
      fen: m.before,
      policy: [[moveToAction(m, m.color), 1]],
      color: m.color,
      ply,
      origin: "human-consented",
      repetition: 1,
      value: win === null ? 0 : win === m.color ? 1 : -1,
    }));
}
