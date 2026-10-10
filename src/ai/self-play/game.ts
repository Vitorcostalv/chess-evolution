import { Chess, DEFAULT_POSITION } from "chess.js";
import { gameResult, winner, repetitionCount } from "@/engine/chess/rules";
import { mctsSearch, type PositionEvaluator } from "@/engine/search/mcts";
import { negamaxSearch } from "@/engine/search/negamax";
import type { StoredGame, TrainingExample, GameResult } from "@/types/domain";
export const cooperate = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));
export async function playGeneratedGame(options: {
  white?: PositionEvaluator;
  black?: PositionEvaluator;
  simulations: number;
  maxPlies: number;
  seed: number;
  mode: "selfplay" | "evaluation";
  beforeMove: () => Promise<void>;
  onMove?: (ply: number, fen: string) => void;
  whiteName: string;
  blackName: string;
}) {
  const chess = new Chess(),
    id = crypto.randomUUID(),
    positions: Omit<TrainingExample, "value">[] = [];
  let result: GameResult | null = null;
  for (let ply = 0; ply < options.maxPlies; ply++) {
    await options.beforeMove();
    result = gameResult(chess);
    if (result) break;
    const color = chess.turn(),
      evaluator = color === "w" ? options.white : options.black;
    const config = {
      algorithm: "mcts" as const,
      depth: 2,
      timeMs: options.mode === "evaluation" ? 100 : 180,
      simulations: options.simulations,
      seed: options.seed + ply,
    };
    const search = evaluator
      ? mctsSearch(
          chess,
          config,
          evaluator,
          options.mode === "selfplay" && ply < 16 ? 1 : 0,
        )
      : negamaxSearch(chess, { ...config, algorithm: "negamax" });
    if (!search.move) throw new Error("Motor não retornou uma jogada legal.");
    if (options.mode === "selfplay")
      positions.push({
        id: `${Date.now().toString().padStart(13, "0")}-${id}-${ply.toString().padStart(3, "0")}`,
        gameId: id,
        fen: chess.fen(),
        policy: search.policy ?? [],
        color,
        ply,
        origin: "selfplay",
        repetition: repetitionCount(chess),
      });
    chess.move(search.move);
    options.onMove?.(ply + 1, chess.fen());
    await cooperate();
  }
  const naturalResult = gameResult(chess);
  result = naturalResult ?? {
    result: "1/2-1/2",
    reason: "Empate adjudicado: orçamento de jogadas",
  };
  chess.setHeader(
    "Event",
    options.mode === "selfplay" ? "Local self-play" : "Local evaluation",
  );
  chess.setHeader("White", options.whiteName);
  chess.setHeader("Black", options.blackName);
  chess.setHeader("Result", result.result);
  const game: StoredGame = {
    termination: naturalResult ? "rules" : "budget",
    id,
    name: `${options.mode === "selfplay" ? "Self-play" : "Avaliação"} · ${new Date().toLocaleString("pt-BR")}`,
    pgn: chess.pgn(),
    initialFen: DEFAULT_POSITION,
    createdAt: new Date().toISOString(),
    mode: options.mode,
    result,
    white: options.whiteName,
    black: options.blackName,
    timeControl: "Orçamento de cálculo local",
    personalLearning: false,
  };
  const win = winner(result),
    examples: TrainingExample[] = positions.map((p) => ({
      ...p,
      value: win === null ? 0 : win === p.color ? 1 : -1,
    }));
  return { game, examples };
}
