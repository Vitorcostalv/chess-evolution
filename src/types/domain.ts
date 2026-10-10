import type { Color, PieceSymbol, Square } from "chess.js";
export type MoveInput = { from: Square; to: Square; promotion?: PieceSymbol };
export type Algorithm = "negamax" | "mcts";
export type SearchConfig = {
  algorithm: Algorithm;
  depth: number;
  timeMs: number;
  simulations: number;
  seed: number;
};
export type SearchResult = {
  move: MoveInput | null;
  score: number;
  scale: "centipawns" | "value";
  depth: number;
  nodes: number;
  timeMs: number;
  pv: string[];
  alternatives: { san: string; score: number; visits?: number }[];
  policy?: [number, number][];
  terminal?: string;
};
export type GameResult = { result: "1-0" | "0-1" | "1/2-1/2"; reason: string };
export type ArenaSession = {
  increment?: number;
  clockHistory?: { w: number; b: number }[];
  blackModelId?: string;
  id: string;
  createdAt: string;
  fen: string;
  pgn: string;
  initialFen: string;
  mode: "human" | "ai" | "local";
  human: Color;
  seconds: { w: number; b: number };
  timeControl: number;
  modelId: string;
  result: GameResult | null;
};
export type StoredGame = {
  termination?: "rules" | "budget" | "time" | "unfinished";
  evaluationId?: string;
  id: string;
  name: string;
  pgn: string;
  initialFen: string;
  createdAt: string;
  mode: "human" | "ai" | "selfplay" | "evaluation" | "import";
  result: GameResult | null;
  white: string;
  black: string;
  timeControl: string;
  personalLearning: boolean;
};
export type Preset = "tiny" | "standard" | "research";
export type SerializedTensor = {
  name: string;
  shape: number[];
  dtype: "float32" | "int32";
  values: number[];
};
export type Checkpoint = {
  format: "chess-evolution-v1";
  encoding: 1;
  actionSpace: 4672;
  preset: Preset;
  generation: number;
  weights: SerializedTensor[];
  optimizer?: SerializedTensor[];
  learningRate: number;
  completedBatches: number;
  hash: string;
};
export type EvaluationRecord = {
  gameIds?: string[];
  conditions?: {
    simulations: number;
    maxPlies: number;
    games: number;
    opponentHash: string;
    candidateHash: string;
    reference: string;
  };
  rejectionReason?: string;
  id: string;
  opponent: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  lowerBound: number;
  eloDifference: number | null;
  promoted: boolean;
  at: string;
};
export type ModelRecord = {
  id: string;
  name: string;
  preset: Preset;
  generation: number;
  createdAt: string;
  origin: string;
  parentId?: string;
  status: "candidate" | "champion" | "archived";
  parameters: number;
  completedBatches: number;
  checkpoint: Checkpoint;
  evaluations: EvaluationRecord[];
};
export type TrainingExample = {
  id: string;
  gameId: string;
  fen: string;
  policy: [number, number][];
  value: number;
  color: Color;
  ply: number;
  origin: "selfplay" | "human-consented";
  repetition: number;
};
export type TrainingConfig = {
  games: number;
  simulations: number;
  maxPlies: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  bufferCapacity: number;
  checkpointEvery: number;
};
export type TrainingMetric = {
  batch: number;
  epoch: number;
  loss: number;
  policyLoss: number;
  valueLoss: number;
  validationLoss: number | null;
  examples: number;
  elapsedMs: number;
  memoryBytes: number;
};
export type LogEntry = {
  at: string;
  level: "info" | "warning" | "error";
  event: string;
  message: string;
};
export type Experiment = {
  endings?: { rules: number; budget: number };
  checkpoints?: number;
  datasetIds?: string[];
  validationGameIds?: string[];
  id: string;
  modelId: string;
  createdAt: string;
  status:
    | "running"
    | "paused"
    | "completed"
    | "cancelled"
    | "interrupted"
    | "error";
  config: TrainingConfig;
  metrics: TrainingMetric[];
  logs: LogEntry[];
  completedGames: number;
};
export type Preferences = {
  appearance: import("@/services/games/appearance").Appearance;
  animation: "normal" | "fast" | "off";
  animationDuration: number;
  graphics: "low" | "medium" | "high";
  board: "3d" | "2d";
  camera: "isometric" | "top";
  sound: boolean;
  hints: boolean;
  personalLearning: boolean;
  autoPause: boolean;
};
export type Tournament = {
  id: string;
  name: string;
  createdAt: string;
  status: "running" | "completed" | "cancelled" | "interrupted";
  participants: { id: string; name: string; hash: string }[];
  standings: {
    id: string;
    name: string;
    wins: number;
    draws: number;
    losses: number;
    points: number;
  }[];
  matches: {
    white: string;
    black: string;
    gameId: string;
    result: GameResult;
  }[];
  simulations: number;
  maxPlies: number;
};
export const DEFAULT_PREFERENCES: Preferences = {
  appearance: {
    preset: "classic",
    light: "#d3be97",
    dark: "#563825",
    white: "#e0ccb0",
    black: "#30373a",
    border: "#433023",
    selected: "#e6c477",
    lastMove: "#bb9a58",
    legal: "#e7cb8a",
    check: "#da786b",
    finish: "polished",
  },
  animation: "normal",
  animationDuration: 240,
  graphics: "medium",
  board: "3d",
  camera: "isometric",
  sound: false,
  hints: true,
  personalLearning: false,
  autoPause: true,
};
