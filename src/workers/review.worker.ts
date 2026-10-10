/// <reference lib="webworker" />
import { loadGame } from "@/engine/chess/rules";
import { reviewPoint } from "@/services/games/review";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage = async (
  event: MessageEvent<{ initialFen: string; pgn: string }>,
) => {
  try {
    const { initialFen, pgn } = event.data,
      length = loadGame(initialFen, pgn).history().length;
    if (length > 240)
      throw new Error("Revisão limitada a 240 meias-jogadas por sessão.");
    const start = Date.now();
    for (let ply = 0; ply <= length; ply++) {
      if (Date.now() - start > 60000)
        throw new Error(
          "Orçamento de revisão atingido. Resultados parciais preservados.",
        );
      self.postMessage({
        point: reviewPoint(initialFen, pgn, ply),
        total: length + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    self.postMessage({ done: true });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Revisão indisponível.",
    });
  }
};
