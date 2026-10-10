import { Chess, type Move } from "chess.js";
import { gameResult } from "@/engine/chess/rules";
import { heuristicValue } from "@/engine/evaluation/heuristic";
import { legalPolicy, moveToAction } from "@/ai/encoding/actions";
import type { SearchConfig, SearchResult } from "@/types/domain";
export type PositionEvaluator = (chess: Chess) => {
  value: number;
  policy?: ArrayLike<number>;
};
type Node = {
  move?: Move;
  prior: number;
  n: number;
  w: number;
  children: Node[] | null;
};
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function mctsSearch(
  chess: Chess,
  config: SearchConfig,
  evaluator: PositionEvaluator = (c) => ({ value: heuristicValue(c) }),
  temperature = 0,
): SearchResult {
  const start = performance.now(),
    root: Node = { prior: 1, n: 0, w: 0, children: null };
  let maxDepth = 0,
    evaluations = 0;
  const terminal = gameResult(chess);
  if (terminal)
    return {
      move: null,
      score: chess.isCheckmate() ? -1 : 0,
      scale: "value",
      depth: 0,
      nodes: 0,
      timeMs: performance.now() - start,
      pv: [],
      alternatives: [],
      terminal: terminal.reason,
    };
  function expand(node: Node): number {
    if (chess.isCheckmate()) {
      node.children = [];
      return -1;
    }
    if (gameResult(chess)) {
      node.children = [];
      return 0;
    }
    const prediction = evaluator(chess);
    evaluations++;
    if (!Number.isFinite(prediction.value))
      throw new Error("Non-finite neural value");
    const legal = chess.moves({ verbose: true });
    const priors = prediction.policy
      ? legalPolicy(prediction.policy, legal, chess.turn())
      : legal.map((move) => ({ move, probability: 1 / legal.length }));
    node.children = priors.map((p) => ({
      move: p.move,
      prior: p.probability,
      n: 0,
      w: 0,
      children: null,
    }));
    return Math.max(-1, Math.min(1, prediction.value));
  }
  expand(root);
  for (let simulation = 0; simulation < config.simulations; simulation++) {
    if (simulation > 0 && performance.now() - start >= config.timeMs) break;
    let node = root;
    const path = [root];
    let moves = 0;
    try {
      while (node.children?.length) {
        const exploration = Math.sqrt(Math.max(1, node.n));
        let best: Node | undefined,
          bestScore = -Infinity;
        for (const child of node.children) {
          const score =
            -(child.n ? child.w / child.n : 0) +
            (1.45 * child.prior * exploration) / (1 + child.n);
          if (score > bestScore) {
            best = child;
            bestScore = score;
          }
        }
        node = best!;
        chess.move(node.move!);
        moves++;
        path.push(node);
        if (moves >= 24) break;
      }
      maxDepth = Math.max(maxDepth, moves);
      let value = expand(node);
      for (let i = path.length - 1; i >= 0; i--) {
        path[i].n++;
        path[i].w += value;
        value = -value;
      }
    } finally {
      for (let i = 0; i < moves; i++) chess.undo();
    }
  }
  const children = [...(root.children ?? [])].sort(
    (a, b) =>
      b.n - a.n ||
      -(b.w / Math.max(1, b.n)) + a.w / Math.max(1, a.n) ||
      a.move!.lan.localeCompare(b.move!.lan),
  );
  let best = children[0];
  if (temperature > 0 && children.length) {
    const random = seededRandom(config.seed),
      weights = children.map((c) => Math.pow(c.n, 1 / temperature)),
      sum = weights.reduce((a, b) => a + b, 0);
    let target = random() * sum;
    for (let i = 0; i < children.length; i++) {
      target -= weights[i];
      if (target <= 0) {
        best = children[i];
        break;
      }
    }
  }
  const move = best?.move,
    total = children.reduce((sum, c) => sum + c.n, 0);
  return {
    move: move
      ? {
          from: move.from,
          to: move.to,
          ...(move.promotion ? { promotion: move.promotion } : {}),
        }
      : null,
    score: root.n ? root.w / root.n : 0,
    scale: "value",
    depth: maxDepth,
    nodes: evaluations,
    timeMs: performance.now() - start,
    pv: move ? [move.san] : [],
    alternatives: children.slice(0, 4).map((c) => ({
      san: c.move!.san,
      score: -c.w / Math.max(1, c.n),
      visits: c.n,
    })),
    policy: children
      .filter((c) => c.n > 0)
      .map((c) => [
        moveToAction(c.move!, chess.turn()),
        c.n / Math.max(1, total),
      ]),
  };
}
