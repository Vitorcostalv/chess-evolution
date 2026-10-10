"use client";
import { create } from "zustand";
import { Chess, type Square, type Color, type PieceSymbol } from "chess.js";
import { gameResult, loadGame, DEFAULT_POSITION } from "@/engine/chess/rules";
import type {
  GameResult,
  MoveInput,
  SearchConfig,
  SearchResult,
  StoredGame,
} from "@/types/domain";
import { storage } from "@/services/storage/database";
import { usePreferences } from "@/stores/preferences";
import { personalExamples } from "@/ai/self-play/personal";
const initial = new Chess();
type State = {
  gameId: string;
  createdAt: string;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
  fen: string;
  pgn: string;
  initialFen: string;
  history: string[];
  selected: Square | null;
  legal: Square[];
  promotion: { from: Square; to: Square } | null;
  redo: MoveInput[];
  result: GameResult | null;
  mode: "human" | "ai" | "local";
  human: Color;
  running: boolean;
  thinking: boolean;
  revision: number;
  seconds: { w: number; b: number };
  timeControl: number;
  modelId: string;
  blackModelId: string;
  search: SearchConfig;
  analysis: SearchResult | null;
  error: string | null;
  select: (square: Square) => void;
  move: (input: MoveInput) => void;
  promote: (piece: PieceSymbol) => void;
  reset: () => void;
  load: (fen: string, pgn?: string) => void;
  undo: () => void;
  forward: () => void;
  tick: () => void;
  save: () => Promise<void>;
  configure: (
    data: Partial<
      Pick<
        State,
        | "mode"
        | "human"
        | "running"
        | "modelId"
        | "blackModelId"
        | "search"
        | "timeControl"
      >
    >,
  ) => void;
};
function chess() {
  const s = useGame.getState();
  return loadGame(s.initialFen, s.pgn);
}
function sound() {
  if (!usePreferences.getState().value.sound) return;
  try {
    const ctx = new AudioContext(),
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 420;
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    osc.onended = () => void ctx.close();
  } catch {
    /* Optional audio may be blocked by the browser. */
  }
}
function update(c: Chess) {
  useGame.setState({
    fen: c.fen(),
    pgn: c.pgn(),
    history: c.history(),
    selected: null,
    legal: [],
    promotion: null,
    result: gameResult(c),
    thinking: false,
    analysis: null,
    revision: useGame.getState().revision + 1,
    error: null,
  });
  void useGame.getState().persist();
}
export const useGame = create<State>((set, get) => ({
  gameId: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  persist: async () => {
    const s = get();
    try {
      await storage.saveSession({
        id: s.gameId,
        createdAt: s.createdAt,
        fen: s.fen,
        pgn: s.pgn,
        initialFen: s.initialFen,
        mode: s.mode,
        human: s.human,
        seconds: s.seconds,
        timeControl: s.timeControl,
        modelId: s.modelId,
        blackModelId: s.blackModelId,
        result: s.result,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Sessão não foi salva.",
      });
    }
  },
  hydrate: async () => {
    try {
      const saved = await storage.session();
      if (!saved || get().revision !== 0) return;
      const c = loadGame(saved.initialFen, saved.pgn);
      if (c.fen() !== saved.fen) throw new Error("Sessão local inconsistente.");
      set({
        gameId: saved.id,
        createdAt: saved.createdAt,
        initialFen: saved.initialFen,
        mode: saved.mode,
        human: saved.human,
        seconds: saved.seconds,
        timeControl: saved.timeControl,
        modelId: saved.modelId,
        blackModelId: saved.blackModelId ?? "heuristic",
        running: false,
      });
      update(c);
      if (saved.result) {
        set({ result: saved.result });
        void get().persist();
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível recuperar a sessão.",
      });
    }
  },
  fen: initial.fen(),
  pgn: "",
  initialFen: DEFAULT_POSITION,
  history: [],
  selected: null,
  legal: [],
  promotion: null,
  redo: [],
  result: null,
  mode: "human",
  human: "w",
  running: true,
  thinking: false,
  revision: 0,
  seconds: { w: 600, b: 600 },
  timeControl: 600,
  modelId: "heuristic",
  blackModelId: "heuristic",
  search: {
    algorithm: "negamax",
    depth: 3,
    timeMs: 450,
    simulations: 24,
    seed: 42,
  },
  analysis: null,
  error: null,
  select: (square) => {
    const s = get(),
      c = chess();
    if (
      s.result ||
      s.thinking ||
      (s.mode !== "local" && (s.mode === "ai" || c.turn() !== s.human))
    )
      return;
    const choices = c
      .moves({ verbose: true })
      .filter((m) => m.from === s.selected && m.to === square);
    if (choices.length) {
      if (choices.some((m) => m.promotion)) {
        set({ promotion: { from: s.selected!, to: square } });
        return;
      }
      s.move({ from: s.selected!, to: square });
      return;
    }
    const piece = c.get(square);
    if (piece?.color === c.turn())
      set({
        selected: square,
        legal: c.moves({ square, verbose: true }).map((m) => m.to),
      });
    else set({ selected: null, legal: [] });
  },
  move: (input) => {
    if (get().result) return;
    try {
      const c = chess();
      c.move(input);
      set({ redo: [] });
      update(c);
      sound();
      if (gameResult(c)) void get().save();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Jogada inválida.",
      });
    }
  },
  promote: (piece) => {
    const pending = get().promotion;
    if (pending) get().move({ ...pending, promotion: piece });
  },
  reset: () => {
    const s = get();
    set({
      initialFen: DEFAULT_POSITION,
      gameId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      redo: [],
      seconds: { w: s.timeControl, b: s.timeControl },
      running: true,
    });
    update(new Chess());
  },
  load: (fen, pgn) => {
    try {
      const c = loadGame(fen, pgn);
      set({
        initialFen: fen,
        gameId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        redo: [],
        running: false,
        seconds: { w: get().timeControl, b: get().timeControl },
      });
      update(c);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "FEN / PGN inválido.",
      });
    }
  },
  undo: () => {
    const c = chess(),
      m = c.undo();
    if (m) {
      set({
        redo: [
          {
            from: m.from,
            to: m.to,
            ...(m.promotion ? { promotion: m.promotion } : {}),
          },
          ...get().redo,
        ],
        running: false,
      });
      update(c);
    }
  },
  forward: () => {
    const [m, ...rest] = get().redo;
    if (m) {
      const c = chess();
      c.move(m);
      set({ redo: rest, running: false });
      update(c);
    }
  },
  tick: () => {
    const s = get();
    if (!s.running || s.result || !s.history.length) return;
    const color = new Chess(s.fen).turn();
    const seconds = {
      ...s.seconds,
      [color]: Math.max(0, s.seconds[color] - 1),
    };
    if (!seconds[color]) {
      const c = new Chess(s.fen);
      const result: GameResult = c.isInsufficientMaterial()
        ? { result: "1/2-1/2", reason: "Tempo esgotado; material insuficiente" }
        : { result: color === "w" ? "0-1" : "1-0", reason: "Tempo esgotado" };
      set({ seconds, result, running: false, revision: s.revision + 1 });
      void get().persist();
      void get().save();
    } else set({ seconds });
  },
  save: async () => {
    const s = get(),
      c = chess();
    c.setHeader(
      "White",
      s.mode === "local"
        ? "Brancas"
        : s.mode === "ai"
          ? "IA branca"
          : s.human === "w"
            ? "Você"
            : "Motor",
    );
    c.setHeader(
      "Black",
      s.mode === "local"
        ? "Pretas"
        : s.mode === "ai"
          ? "IA preta"
          : s.human === "b"
            ? "Você"
            : "Motor",
    );
    c.setHeader("Result", s.result?.result ?? "*");
    const game: StoredGame = {
      id: s.gameId,
      name: `Arena · ${new Date().toLocaleString("pt-BR")}`,
      pgn: c.pgn(),
      initialFen: s.initialFen,
      createdAt: s.createdAt,
      mode: s.mode === "ai" ? "ai" : "human",
      result: s.result,
      white: c.getHeaders().White,
      black: c.getHeaders().Black,
      timeControl: String(s.timeControl),
      personalLearning: usePreferences.getState().value.personalLearning,
    };
    try {
      await storage.saveGame(game);
      const examples = personalExamples(
        game,
        s.mode === "local" ? undefined : s.human,
      );
      if (examples.length) await storage.addReplay(examples);
      set({ error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Não foi possível salvar.",
      });
    }
  },
  configure: (data) => {
    set({ ...data, revision: get().revision + 1, thinking: false });
    void get().persist();
  },
}));
