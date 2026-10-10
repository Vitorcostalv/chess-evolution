import { loadGame } from "@/engine/chess/rules";
import { negamaxSearch } from "@/engine/search/negamax";
import type { SearchResult } from "@/types/domain";
export type ReviewPoint = {
  ply: number;
  score: number;
  san: string | null;
  suggested: string | null;
  pv: string[];
  alternatives: SearchResult["alternatives"];
  nodes: number;
  timeMs: number;
};
export const REVIEW_CONFIG = {
  algorithm: "negamax" as const,
  depth: 2,
  timeMs: 150,
  simulations: 24,
  seed: 42,
};
export function reviewPoint(
  initialFen: string,
  pgn: string,
  ply: number,
): ReviewPoint {
  const original = loadGame(initialFen, pgn),
    moves = original.history({ verbose: true });
  const c = loadGame(initialFen);
  for (const m of moves.slice(0, ply)) c.move(m);
  const side = c.turn(),
    result = negamaxSearch(c, REVIEW_CONFIG);
  return {
    ply,
    score: (result.score * (side === "w" ? 1 : -1)) / 100,
    san: moves[ply]?.san ?? null,
    suggested: result.pv[0] ?? null,
    pv: result.pv,
    alternatives: result.alternatives,
    nodes: result.nodes,
    timeMs: result.timeMs,
  };
}
