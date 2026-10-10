"use client";
import { create } from "zustand";
import type {
  ModelRecord,
  Experiment,
  EvaluationRecord,
  Preset,
  TrainingConfig,
  Tournament,
} from "@/types/domain";
import type { LabRequest, LabResponse } from "@/workers/protocol";
import { storage } from "@/services/storage/database";
let worker: Worker | null = null;
type LabState = {
  models: ModelRecord[];
  experiment: Experiment | null;
  busy: boolean;
  paused: boolean;
  error: string | null;
  message: string;
  backend: string;
  evaluation: EvaluationRecord | null;
  tournaments: Tournament[];
  tournament: (ids: string[], simulations: number, maxPlies: number) => void;
  refresh: () => Promise<void>;
  createModel: (name: string, preset: Preset) => void;
  importModel: (model: ModelRecord) => void;
  train: (id: string, config: TrainingConfig, resume?: boolean) => void;
  evaluate: (
    id: string,
    games: number,
    simulations: number,
    maxPlies: number,
    opponentId?: string,
  ) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  terminate: () => void;
};
function send(request: LabRequest) {
  if (!worker) {
    worker = new Worker(
      new URL("../workers/training.worker.ts", import.meta.url),
    );
    worker.onmessage = (event: MessageEvent<LabResponse>) => {
      const data = event.data,
        state = useLab.getState();
      if (data.type === "model") {
        useLab.setState({
          models: [
            data.model,
            ...state.models.filter((m) => m.id !== data.model.id),
          ],
        });
      }
      if (data.type === "tournament")
        useLab.setState({
          tournaments: [
            data.tournament,
            ...state.tournaments.filter((t) => t.id !== data.tournament.id),
          ],
        });
      if (data.type === "experiment")
        useLab.setState({ experiment: data.experiment, backend: data.backend });
      if (data.type === "progress") useLab.setState({ message: data.message });
      if (data.type === "evaluation")
        useLab.setState({ evaluation: data.record });
      if (data.type === "done") {
        useLab.setState({
          busy: false,
          paused: false,
          message: "Tarefa concluída.",
        });
        void state.refresh();
      }
      if (data.type === "error")
        useLab.setState({
          busy: false,
          paused: false,
          error: data.message,
          message: data.message,
        });
    };
    worker.onerror = () => {
      useLab.setState({
        busy: false,
        error: "Worker interrompido. Pesos recuperáveis no último checkpoint.",
      });
      worker?.terminate();
      worker = null;
    };
  }
  worker.postMessage(request);
}
function start(request: LabRequest) {
  if (useLab.getState().busy) return;
  useLab.setState({
    busy: true,
    paused: false,
    error: null,
    message: "Inicializando worker neural…",
  });
  send(request);
}
export const useLab = create<LabState>((set) => ({
  models: [],
  tournaments: [],
  experiment: null,
  busy: false,
  paused: false,
  error: null,
  message: "Nenhuma tarefa em execução.",
  backend: "não iniciado",
  evaluation: null,
  refresh: async () => {
    try {
      const [models, experiments, tournaments] = await Promise.all([
        storage.models(),
        storage.experiments(),
        storage.tournaments(),
      ]);
      set({
        models,
        tournaments,
        ...(!useLab.getState().busy
          ? {
              experiment: experiments[0]
                ? {
                    ...experiments[0],
                    status:
                      experiments[0].status === "running"
                        ? "interrupted"
                        : experiments[0].status,
                  }
                : null,
            }
          : {}),
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Falha no armazenamento.",
      });
    }
  },
  tournament: (modelIds, simulations, maxPlies) =>
    start({
      type: "tournament",
      id: crypto.randomUUID(),
      modelIds,
      simulations,
      maxPlies,
    }),
  createModel: (name, preset) =>
    start({ type: "create", id: crypto.randomUUID(), name, preset }),
  importModel: (model) =>
    start({ type: "import", id: crypto.randomUUID(), model }),
  train: (modelId, config, resume) =>
    start({ type: "train", id: crypto.randomUUID(), modelId, config, resume }),
  evaluate: (modelId, games, simulations, maxPlies, opponentId) =>
    start({
      type: "evaluate",
      id: crypto.randomUUID(),
      modelId,
      games,
      simulations,
      maxPlies,
      opponentId,
    }),
  pause: () => {
    send({ type: "pause" });
    set({ paused: true, message: "Pausa solicitada." });
  },
  resume: () => {
    send({ type: "resume" });
    set({ paused: false });
  },
  cancel: () => {
    send({ type: "cancel" });
    set({ message: "Cancelamento solicitado. Preservando checkpoint…" });
  },
  terminate: () => {
    worker?.terminate();
    worker = null;
    set({
      busy: false,
      paused: false,
      message: "Worker encerrado; último checkpoint preservado.",
    });
  },
}));
