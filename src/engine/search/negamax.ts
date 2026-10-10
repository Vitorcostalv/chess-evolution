import { Chess, type Move } from "chess.js";
import type { SearchConfig, SearchResult, MoveInput } from "@/types/domain";
import { gameResult } from "@/engine/chess/rules";
import { evaluateWhite } from "@/engine/evaluation/heuristic";
import { zobrist, hashText } from "@/engine/hashing/zobrist";
const MATE = 100000,
  INFINITY = 200000;
const VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};
type Entry = {
  depth: number;
  score: number;
  flag: "exact" | "lower" | "upper";
  move?: string;
};
class SearchStopped extends Error {}
export function negamaxSearch(
  chess: Chess,
  config: SearchConfig,
  cancelled = () => false,
): SearchResult {
  const start = performance.now(),
    deadline = start + config.timeMs,
    tt = new Map<bigint, Entry>();
  let nodes = 0;
  const stop = () => {
    if (cancelled() || performance.now() >= deadline || nodes >= 100000)
      throw new SearchStopped();
  };
  const terminal = (ply: number): number | null => {
    if (chess.isCheckmate()) return -MATE + ply;
    if (gameResult(chess)) return 0;
    return null;
  };
  const staticEval = () =>
    evaluateWhite(chess) * (chess.turn() === "w" ? 1 : -1);
  function ordered(moves: Move[], preferred?: string) {
    return moves.sort(
      (a, b) =>
        priority(b, preferred) - priority(a, preferred) ||
        a.lan.localeCompare(b.lan),
    );
  }
  function priority(m: Move, preferred?: string) {
    return (
      (m.lan === preferred ? 100000 : 0) +
      (m.captured ? 10 * VALUES[m.captured] - VALUES[m.piece] : 0) +
      (m.promotion ? VALUES[m.promotion] : 0) +
      (m.san.includes("+") ? 20 : 0)
    );
  }
  function quiescence(
    alpha: number,
    beta: number,
    ply: number,
    qDepth: number,
  ): number {
    nodes++;
    stop();
    const t = terminal(ply);
    if (t !== null) return t;
    const checked = chess.isCheck();
    if (qDepth >= 8) return staticEval();
    if (!checked) {
      const stand = staticEval();
      if (stand >= beta) return beta;
      alpha = Math.max(alpha, stand);
    }
    const moves = ordered(
      chess
        .moves({ verbose: true })
        .filter((m) => checked || m.captured || m.promotion),
    );
    for (const m of moves) {
      chess.move(m);
      let score: number;
      try {
        score = -quiescence(-beta, -alpha, ply + 1, qDepth + 1);
      } finally {
        chess.undo();
      }
      if (score >= beta) return beta;
      alpha = Math.max(alpha, score);
    }
    return alpha;
  }
  function visit(
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    nodes++;
    stop();
    const t = terminal(ply);
    if (t !== null) return t;
    if (depth === 0) return quiescence(alpha, beta, ply, 0);
    // Include reversible history and halfmove clock: repetition/50-move contexts cannot share entries.
    const key =
      zobrist(chess.fen()) ^
      hashText(chess.history().join(" ") + ":" + chess.fen().split(" ")[4]);
    const cached = tt.get(key),
      originalAlpha = alpha;
    if (
      cached &&
      cached.depth >= depth &&
      Math.abs(cached.score) < MATE - 200
    ) {
      if (cached.flag === "exact") return cached.score;
      if (cached.flag === "lower") alpha = Math.max(alpha, cached.score);
      else beta = Math.min(beta, cached.score);
      if (alpha >= beta) return cached.score;
    }
    let best = -INFINITY,
      bestMove: string | undefined;
    for (const m of ordered(chess.moves({ verbose: true }), cached?.move)) {
      chess.move(m);
      let score: number;
      try {
        score = -visit(depth - 1, -beta, -alpha, ply + 1);
      } finally {
        chess.undo();
      }
      if (score > best) {
        best = score;
        bestMove = m.lan;
      }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    if (tt.size < 30000)
      tt.set(key, {
        depth,
        score: best,
        flag:
          best <= originalAlpha ? "upper" : best >= beta ? "lower" : "exact",
        move: bestMove,
      });
    return best;
  }
  const result = gameResult(chess),
    legal = ordered(chess.moves({ verbose: true }));
  if (result || !legal.length)
    return {
      move: null,
      score: chess.isCheckmate() ? -MATE : 0,
      scale: "centipawns",
      depth: 0,
      nodes: 0,
      timeMs: performance.now() - start,
      pv: [],
      alternatives: [],
      terminal: result?.reason,
    };
  let best = legal[0],
    score = staticEval(),
    depthReached = 0;
  let alternatives: SearchResult["alternatives"] = [];
  for (let depth = 1; depth <= config.depth; depth++) {
    try {
      const row: { m: Move; score: number }[] = [];
      for (const m of ordered([...legal], best.lan)) {
        stop();
        chess.move(m);
        let value: number;
        try {
          value = -visit(depth - 1, -INFINITY, INFINITY, 1);
        } finally {
          chess.undo();
        }
        row.push({ m, score: value });
      }
      row.sort((a, b) => b.score - a.score || a.m.lan.localeCompare(b.m.lan));
      best = row[0].m;
      score = row[0].score;
      depthReached = depth;
      alternatives = row
        .slice(0, 4)
        .map((r) => ({ san: r.m.san, score: r.score }));
      if (Math.abs(score) >= MATE - 100) break;
    } catch (error) {
      if (!(error instanceof SearchStopped)) throw error;
      break;
    }
  }
  if (cancelled()) throw new Error("SEARCH_CANCELLED");
  const move: MoveInput = {
    from: best.from,
    to: best.to,
    ...(best.promotion ? { promotion: best.promotion } : {}),
  };
  // Build a legal principal variation using the context-sensitive table.
  const pv = [best.san];
  chess.move(best);
  try {
    for (let i = 1; i < depthReached; i++) {
      const key =
        zobrist(chess.fen()) ^
        hashText(chess.history().join(" ") + ":" + chess.fen().split(" ")[4]);
      const e = tt.get(key);
      const next = chess
        .moves({ verbose: true })
        .find((m) => m.lan === e?.move);
      if (!next) break;
      pv.push(next.san);
      chess.move(next);
    }
  } finally {
    for (let i = 0; i < pv.length; i++) chess.undo();
  }
  return {
    move,
    score,
    scale: "centipawns",
    depth: depthReached,
    nodes,
    timeMs: performance.now() - start,
    pv,
    alternatives,
  };
}
