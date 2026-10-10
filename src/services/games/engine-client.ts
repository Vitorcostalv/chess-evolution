import type { EngineRequest, EngineResponse } from "@/workers/protocol";
import type { SearchResult } from "@/types/domain";
export class EngineClient {
  private worker: Worker | null = null;
  private rejectPending: ((error: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
    this.rejectPending?.(new Error("SEARCH_CANCELLED"));
    this.rejectPending = null;
  }
  search(input: Omit<EngineRequest, "id">): Promise<SearchResult> {
    this.cancel();
    const id = crypto.randomUUID();
    this.worker = new Worker(
      new URL("../../workers/engine.worker.ts", import.meta.url),
    );
    return new Promise((resolve, reject) => {
      this.rejectPending = reject;
      const worker = this.worker!;
      const timeout = setTimeout(
        () => {
          this.cancel();
        },
        input.model ? 60000 : input.config.timeMs + 10000,
      );
      this.timer = timeout;
      worker.onmessage = (event: MessageEvent<EngineResponse>) => {
        if (event.data.id !== id) return;
        clearTimeout(timeout);
        this.rejectPending = null;
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        if (event.data.result) resolve(event.data.result);
        else reject(new Error(event.data.error ?? "Falha no motor."));
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        this.rejectPending = null;
        worker.terminate();
        reject(new Error("Não foi possível iniciar o worker de xadrez."));
      };
      worker.postMessage({ ...input, id });
    });
  }
}
