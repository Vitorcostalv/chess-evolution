/// <reference lib="webworker" />
import { loadGame } from "@/engine/chess/rules";
import { negamaxSearch } from "@/engine/search/negamax";
import { mctsSearch } from "@/engine/search/mcts";
import type { EngineRequest, EngineResponse } from "./protocol";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  try {
    const chess = loadGame(request.fen, request.pgn);
    if (chess.fen() !== request.fen)
      throw new Error("Estado de busca incompatível com o histórico.");
    let result,
      backend = "heuristic";
    if (request.model) {
      const { initializeBackend, restoreCheckpoint, infer } =
        await import("@/ai/neural/network");
      backend = await initializeBackend();
      const model = await restoreCheckpoint(request.model.checkpoint);
      try {
        result = mctsSearch(chess, request.config, (c) => infer(model, c));
      } finally {
        model.optimizer.dispose();
        model.dispose();
      }
    } else
      result =
        request.config.algorithm === "negamax"
          ? negamaxSearch(chess, request.config)
          : mctsSearch(chess, request.config);
    self.postMessage({
      id: request.id,
      result,
      backend,
    } satisfies EngineResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : "Falha no motor.",
    } satisfies EngineResponse);
  }
};
