import type {
  SearchConfig,
  SearchResult,
  ModelRecord,
  TrainingConfig,
  Experiment,
  EvaluationRecord,
  Preset,
  Tournament,
} from "@/types/domain";
export type EngineRequest = {
  id: string;
  fen: string;
  pgn?: string;
  config: SearchConfig;
  model?: ModelRecord;
};
export type EngineResponse = {
  id: string;
  result?: SearchResult;
  error?: string;
  backend?: string;
};
export type LabRequest =
  | { type: "create"; id: string; name: string; preset: Preset }
  | { type: "import"; id: string; model: ModelRecord }
  | {
      type: "train";
      id: string;
      modelId: string;
      config: TrainingConfig;
      resume?: boolean;
    }
  | {
      type: "evaluate";
      id: string;
      modelId: string;
      opponentId?: string;
      games: number;
      simulations: number;
      maxPlies: number;
    }
  | {
      type: "tournament";
      id: string;
      modelIds: string[];
      simulations: number;
      maxPlies: number;
    }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "cancel" };
export type LabResponse =
  | { type: "model"; model: ModelRecord }
  | { type: "tournament"; tournament: Tournament }
  | { type: "experiment"; experiment: Experiment; backend: string }
  | { type: "progress"; message: string; ply?: number; fen?: string }
  | { type: "evaluation"; record: EvaluationRecord; modelId: string }
  | { type: "done"; id: string }
  | { type: "error"; id: string; message: string };
