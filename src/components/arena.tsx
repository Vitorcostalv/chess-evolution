"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  type ReactNode,
} from "react";
import { Chess, type Square } from "chess.js";
import {
  RotateCcw,
  RotateCw,
  Play,
  Pause,
  ArrowDownUp,
  Scan,
  Save,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ArrowUpRight,
} from "lucide-react";
import { useGame } from "@/stores/game";
import { useLab } from "@/stores/lab";
import { usePreferences } from "@/stores/preferences";
import { useBoardMotion } from "./use-board-motion";
import { PieceSvg } from "./piece-svg";
import { GameReview } from "./game-review";
import { positionSummary, replayPosition } from "@/services/games/presentation";
import { CLOCK_PRESETS } from "@/services/games/clocks";
import { Board2D } from "./board-2d";
import { EngineClient } from "@/services/games/engine-client";
const Board3D = dynamic(() => import("./board-3d"), {
  ssr: false,
  loading: () => <div className="loading-board">Preparando o tabuleiro…</div>,
});
class BoardBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function clock(seconds: number) {
  seconds = Math.ceil(seconds);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function Arena() {
  const s = useGame(),
    prefs = usePreferences((st) => st.value),
    models = useLab((st) => st.models),
    labBusy = useLab((st) => st.busy && !st.paused),
    client = useRef<EngineClient | null>(null),
    lastStep = useRef(0),
    exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [flip, setFlip] = useState(false),
    [fen, setFen] = useState(""),
    [toast, setToast] = useState(""),
    [gpu, setGpu] = useState<boolean | null>(null),
    [fallbackReason, setFallbackReason] = useState(""),
    [gpuRetry, setGpuRetry] = useState(0),
    [cameraReset, setCameraReset] = useState(0),
    [cursor, setCursor] = useState<number | null>(null),
    [playingReplay, setPlayingReplay] = useState(false),
    [replaySpeed, setReplaySpeed] = useState(800),
    [panel, setPanel] = useState("game"),
    [hint, setHint] = useState<{
      fen: string;
      stage: number;
      result: import("@/types/domain").SearchResult;
    } | null>(null);
  const modelLabel = (id: string) => {
    const m = models.find((model) => model.id === id);
    return m
      ? `${m.name} · geração ${m.generation} · ${m.completedBatches ? `${m.completedBatches} lotes de treino` : "sem treino"}`
      : "Motor heurístico";
  };
  const turn = new Chess(s.fen).turn(),
    engineId = s.mode === "ai" && turn === "b" ? s.blackModelId : s.modelId,
    model = models.find((m) => m.id === engineId);
  const retryGpu = () => {
    setGpu(null);
    setFallbackReason("");
    setGpuRetry((n) => n + 1);
  };
  const unavailable = useCallback(() => {
    setGpu(false);
    setFallbackReason(
      "O 3D ficou indisponível neste dispositivo. A partida continua em 2D.",
    );
  }, []);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    const raf = requestAnimationFrame(() => {
      setGpu(!!gl);
      if (!gl)
        setFallbackReason(
          "Este navegador não disponibilizou o 3D. Você pode jogar em 2D.",
        );
    });
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return () => cancelAnimationFrame(raf);
  }, [gpuRetry]);
  useEffect(() => {
    clearTimeout(exitTimer.current);
    client.current = new EngineClient();
    void useGame.getState().hydrate();
    const timer = setInterval(() => useGame.getState().tick(), 250);
    return () => {
      clearInterval(timer);
      client.current?.cancel();
      exitTimer.current = setTimeout(() => {
        const current = useGame.getState();
        current.configure({ running: false });
        useGame.setState({
          visualToken: current.visualToken + 1,
          visualPending: false,
          visualSound: false,
          visualDuration: 0,
        });
      }, 0);
    };
  }, []);
  useEffect(() => {
    const state = useGame.getState(),
      c = new Chess(state.fen);
    const stepping =
      state.mode === "ai" && state.stepRequest > lastStep.current;
    if (
      (!state.running && !stepping) ||
      state.result ||
      state.mode === "local" ||
      (state.mode === "human" && c.turn() === state.human)
    )
      return;
    if (labBusy) {
      useGame.getState().configure({ running: false });
      useGame.setState({
        error:
          "Partida pausada durante a tarefa neural. Conclua ou pause o laboratório antes de continuar.",
      });
      return;
    }
    if (stepping) lastStep.current = state.stepRequest;
    if (engineId !== "heuristic" && !model) {
      useGame.setState({
        running: false,
        error:
          "Modelo selecionado indisponível. Selecione um modelo local ou o motor heurístico.",
      });
      return;
    }
    let cancelled = false;
    const revision = state.revision;
    useGame.setState({ thinking: true });
    const delay = setTimeout(
      () => {
        void client.current
          ?.search({
            fen: state.fen,
            pgn: state.pgn,
            config: model
              ? { ...state.search, algorithm: "mcts" }
              : state.search,
            model,
          })
          .then((result) => {
            if (cancelled || useGame.getState().revision !== revision) return;
            useGame.setState({ analysis: result, thinking: false });
            if (result.move) {
              useGame.getState().move(result.move);
              useGame.setState({ analysis: result });
            }
          })
          .catch((error) => {
            if (!cancelled && error.message !== "SEARCH_CANCELLED")
              useGame.setState({
                thinking: false,
                running: false,
                error: error.message,
              });
          });
      },
      stepping ? 0 : state.mode === "ai" ? state.aiDelay : 120,
    );
    return () => {
      cancelled = true;
      clearTimeout(delay);
      client.current?.cancel();
      useGame.setState({ thinking: false });
    };
  }, [s.revision, s.fen, s.stepRequest, model, engineId, labBusy]);
  const analyze = async () => {
    if (!client.current || s.thinking || labBusy) return;
    s.configure({ running: false });
    useGame.setState({ thinking: true });
    const revision = useGame.getState().revision;
    try {
      const result = await client.current.search({
        fen: s.fen,
        pgn: s.pgn,
        config: model ? { ...s.search, algorithm: "mcts" } : s.search,
        model,
      });
      if (useGame.getState().revision === revision) {
        useGame.setState({ analysis: result, thinking: false });
        return result;
      }
    } catch (error) {
      if (useGame.getState().revision !== revision) return;
      useGame.setState({
        thinking: false,
        error: error instanceof Error ? error.message : "Falha de análise.",
      });
    }
  };
  const reviewing = cursor !== null;
  const review = useMemo(
    () =>
      reviewing
        ? replayPosition(s.initialFen, s.pgn, cursor)
        : { fen: s.fen, pgn: s.pgn },
    [reviewing, cursor, s.initialFen, s.pgn, s.fen],
  );
  const summary = useMemo(
    () => positionSummary(s.initialFen, review.pgn),
    [s.initialFen, review.pgn],
  );
  const { completeVisual, visualToken } = s;
  const complete = useCallback(
    () => completeVisual(visualToken),
    [completeVisual, visualToken],
  );
  const motion = useBoardMotion(
    s.initialFen,
    review.pgn,
    s.gameId,
    reviewing ? (prefs.animation === "off" ? 0 : 120) : s.visualDuration,
    reviewing ? undefined : complete,
  );
  const navigate = (ply: number) => {
    s.configure({ running: false });
    setCursor(Math.max(0, Math.min(s.history.length, ply)));
  };
  useEffect(() => {
    if (!playingReplay || cursor === null) return;
    const timer = setTimeout(() => {
      if (cursor < s.history.length) setCursor(cursor + 1);
      else setPlayingReplay(false);
    }, replaySpeed);
    return () => clearTimeout(timer);
  }, [playingReplay, cursor, replaySpeed, s.history.length]);
  const requestHint = async () => {
    if (hint?.fen === s.fen && hint.stage < 3) {
      setHint({ ...hint, stage: hint.stage + 1 });
      return;
    }
    const currentFen = s.fen,
      result = await analyze();
    if (result && useGame.getState().fen === currentFen)
      setHint({ fen: currentFen, stage: 1, result });
  };
  const currentHint = hint?.fen === s.fen ? hint : null;
  const select = s.select;
  const selectSquare = useCallback(
    (square: Square) => {
      if (!reviewing) select(square);
    },
    [reviewing, select],
  );
  const boardProps = {
    initialFen: s.initialFen,
    pgn: review.pgn,
    fen: review.fen,
    selected:
      s.selected ??
      (currentHint?.stage === 1
        ? (currentHint.result.move?.from ?? null)
        : null),
    legal:
      currentHint && currentHint.stage >= 2 && currentHint.result.move
        ? [currentHint.result.move.to]
        : prefs.hints
          ? s.legal
          : [],
    onSelect: selectSquare,
    flipped: flip,
    appearance: prefs.appearance,
    pieces: motion.pieces,
    duration: motion.duration,
    started: motion.started,
    last: summary.last,
    check: summary.check,
  };
  const startNew = () => {
    setCursor(null);
    setPlayingReplay(false);
    setHint(null);
    s.reset();
  };
  return (
    <div
      className={`arena-page ${s.running || s.history.length ? "compact-arena" : ""}`}
      key={s.gameId}
    >
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> PLAY. OBSERVE. EVOLVE.
          </div>
          <h1>
            Cada posição,
            <br />
            <em>uma possibilidade.</em>
          </h1>
          <p>O clássico encontra uma inteligência em construção.</p>
        </div>
        <Link className="text-link" href="/lab">
          Entre no laboratório <ArrowUpRight size={17} />
        </Link>
      </section>
      <div className="arena-layout">
        <section
          className="board-section"
          data-transition={s.visualPending ? "true" : "false"}
        >
          <div className="board-clocks">
            {(["b", "w"] as const).map((color) => (
              <div
                key={color}
                className={turn === color && !s.result ? "active-clock" : ""}
              >
                <span>
                  {color === "w" ? "Brancas" : "Pretas"}
                  {turn === color && !s.result ? " · jogam" : ""}
                </span>
                <strong>{s.timeControl ? clock(s.seconds[color]) : "∞"}</strong>
              </div>
            ))}
          </div>
          <div className="board-top">
            <span>
              <span className="status-dot" />
              {reviewing
                ? `Revisão · ${cursor}/${s.history.length} meias-jogadas`
                : s.result
                  ? s.result.reason
                  : summary.check
                    ? "Xeque"
                    : s.visualPending
                      ? "Movimento em andamento…"
                      : s.thinking
                        ? "Motor pensando…"
                        : turn === "w"
                          ? "Brancas a jogar"
                          : "Pretas a jogar"}
            </span>
            <span>
              {prefs.board === "3d" && gpu === null
                ? "PREPARANDO"
                : prefs.board === "3d" && gpu
                  ? "REALTIME 3D"
                  : "ACCESSIBLE 2D"}
            </span>
          </div>
          <div className="board-stage">
            {prefs.board === "2d" || gpu === false ? (
              <Board2D {...boardProps} />
            ) : gpu === null ? (
              <div className="loading-board">Preparando o tabuleiro…</div>
            ) : (
              <BoardBoundary
                key={gpuRetry}
                onError={unavailable}
                fallback={<Board2D {...boardProps} />}
              >
                <Board3D
                  {...boardProps}
                  top={prefs.camera === "top"}
                  graphics={prefs.graphics}
                  cameraReset={cameraReset}
                  onUnavailable={unavailable}
                />
              </BoardBoundary>
            )}
            {s.promotion && (
              <div className="promotion">
                <p>Escolha a promoção</p>
                {(["q", "r", "b", "n"] as const).map((p, i) => (
                  <button
                    key={p}
                    aria-label={`Promover para ${["dama", "torre", "bispo", "cavalo"][i]}`}
                    onClick={() => s.promote(p)}
                  >
                    <PieceSvg
                      type={p}
                      color={turn}
                      fill={
                        turn === "w"
                          ? prefs.appearance.white
                          : prefs.appearance.black
                      }
                    />
                  </button>
                ))}
              </div>
            )}
            {s.result && !reviewing && (
              <div className="result-banner">
                <strong>{s.result.result}</strong>
                <span>{s.result.reason}</span>
              </div>
            )}
          </div>
          {prefs.board === "3d" && gpu === false && (
            <div className="fallback-note" role="status">
              {fallbackReason}
              <button onClick={retryGpu}>Tentar 3D novamente</button>
            </div>
          )}
          <div className="board-toolbar">
            <button
              className="icon-button"
              aria-label={s.running ? "Pausar partida" : "Continuar partida"}
              disabled={!!s.result}
              onClick={() => {
                setCursor(null);
                setPlayingReplay(false);
                s.configure({ running: !s.running });
              }}
            >
              {s.running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div>
              <button
                className="icon-button"
                title="Desfazer"
                aria-label="Desfazer jogada"
                onClick={s.undo}
                disabled={!s.history.length}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                title="Refazer"
                aria-label="Refazer jogada"
                onClick={s.forward}
                disabled={!s.redo.length}
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Restaurar câmera"
                title="Restaurar câmera"
                onClick={() => setCameraReset((n) => n + 1)}
              >
                <RotateCcw size={17} />
              </button>
              <span className="divider" />
              <button
                className="icon-button"
                title="Inverter tabuleiro"
                aria-label="Inverter tabuleiro"
                onClick={() => setFlip(!flip)}
              >
                <ArrowDownUp size={17} />
              </button>
              <button
                className="icon-button"
                title="Vista superior"
                aria-label="Alternar câmera"
                onClick={() =>
                  void usePreferences.getState().update({
                    camera: prefs.camera === "top" ? "isometric" : "top",
                  })
                }
              >
                <Maximize2 size={17} />
              </button>
              <button
                className="icon-button"
                title="Alternar 2D/3D"
                aria-label="Alternar 2D/3D"
                onClick={() =>
                  void usePreferences
                    .getState()
                    .update({ board: prefs.board === "3d" ? "2d" : "3d" })
                }
              >
                <Scan size={17} />
              </button>
            </div>
            <span className="board-hint">
              {prefs.board === "3d" && gpu
                ? "Arraste para explorar · clique para jogar"
                : "Clique na peça e no destino"}
            </span>
            <button
              className="icon-button"
              title="Salvar partida"
              aria-label="Salvar partida"
              onClick={() =>
                void s
                  .save()
                  .then(() =>
                    setToast(
                      useGame.getState().error ??
                        "Partida salva na biblioteca.",
                    ),
                  )
              }
            >
              <Save size={17} />
            </button>
          </div>
        </section>
        <details className="mobile-sidebar-shell" open>
          <summary>Painel da partida · jogadas, análise e configuração</summary>
          <aside className="arena-sidebar">
            <div
              className="arena-tabs"
              role="tablist"
              aria-label="Painel da partida"
            >
              {[
                ["game", "Configuração"],
                ["moves", "Jogadas"],
                ["analysis", "Análise"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={panel === id}
                  onClick={() => setPanel(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <span className="eyebrow">01 / PARTIDA</span>
                <span className="tag">
                  {s.mode === "ai"
                    ? "IA × IA"
                    : s.mode === "local"
                      ? "LOCAL"
                      : "HUMANO × IA"}
                </span>
              </div>
              <div className={`player-row ${turn === "b" ? "current" : ""}`}>
                <span className="piece-icon">
                  <PieceSvg type="k" color="b" fill={prefs.appearance.black} />
                </span>
                <div>
                  <strong>
                    {s.mode === "local"
                      ? "Pretas"
                      : s.mode === "human" && s.human === "b"
                        ? "Você"
                        : "Inteligência artificial"}
                  </strong>
                  <small>
                    {s.mode === "human" && s.human === "b"
                      ? "Lado humano"
                      : s.mode === "local"
                        ? "Dois jogadores · local"
                        : modelLabel(
                            s.mode === "ai" ? s.blackModelId : s.modelId,
                          )}
                  </small>
                </div>
                <time>{s.timeControl ? clock(s.seconds.b) : "∞"}</time>
              </div>
              <div className={`player-row ${turn === "w" ? "current" : ""}`}>
                <span className="piece-icon ivory">
                  <PieceSvg type="k" color="w" fill={prefs.appearance.white} />
                </span>
                <div>
                  <strong>
                    {s.mode === "local"
                      ? "Brancas"
                      : s.mode === "human" && s.human === "w"
                        ? "Você"
                        : "Inteligência artificial"}
                  </strong>
                  <small>
                    {s.mode === "human" && s.human === "w"
                      ? "Lado humano"
                      : s.mode === "local"
                        ? "Dois jogadores · local"
                        : modelLabel(s.modelId)}
                  </small>
                </div>
                <time>{s.timeControl ? clock(s.seconds.w) : "∞"}</time>
              </div>
              <details
                className="game-config"
                open={!s.history.length || !s.running}
              >
                <summary>Configurar partida</summary>
                <div className="form-grid">
                  <label>
                    Modo
                    <select
                      value={s.mode}
                      onChange={(e) =>
                        s.configure({
                          mode: e.target.value as typeof s.mode,
                          running: false,
                        })
                      }
                    >
                      <option value="human">Humano × IA</option>
                      <option value="ai">IA × IA</option>
                      <option value="local">Dois jogadores</option>
                    </select>
                  </label>
                  <label>
                    Seu lado
                    <select
                      value={s.human}
                      onChange={(e) => {
                        s.configure({
                          human: e.target.value as "w" | "b",
                          running: false,
                        });
                        setFlip(e.target.value === "b");
                      }}
                    >
                      <option value="w">Brancas</option>
                      <option value="b">Pretas</option>
                    </select>
                  </label>
                  <label>
                    Relógio
                    <select
                      disabled={s.history.length > 0}
                      value={`${s.timeControl}+${s.increment}`}
                      onChange={(e) =>
                        s.configure({
                          timeControl: Number(e.target.value.split("+")[0]),
                          increment: Number(e.target.value.split("+")[1]),
                          running: false,
                        })
                      }
                    >
                      {CLOCK_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {s.mode === "ai" ? "IA branca" : "Motor"}
                    <select
                      value={s.modelId}
                      onChange={(e) =>
                        s.configure({ modelId: e.target.value, running: false })
                      }
                    >
                      <option value="heuristic">Heurístico</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {!m.completedBatches ? " (sem treino)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {s.mode === "ai" && (
                    <label className="wide">
                      IA preta
                      <select
                        value={s.blackModelId}
                        onChange={(e) =>
                          s.configure({
                            blackModelId: e.target.value,
                            running: false,
                          })
                        }
                      >
                        <option value="heuristic">Heurístico</option>
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                            {!m.completedBatches ? " (sem treino)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </details>
              <div className="button-row">
                <button
                  className="primary"
                  onClick={() => {
                    setCursor(null);
                    setPlayingReplay(false);
                    s.configure({ running: !s.running });
                  }}
                >
                  {s.running ? <Pause size={15} /> : <Play size={15} />}{" "}
                  {s.running ? "Pausar" : "Continuar"}
                </button>
                <button onClick={startNew}>
                  <RotateCcw size={15} /> Nova partida
                </button>
              </div>
            </div>
            {s.mode === "ai" && (
              <div className="panel">
                <label>
                  Velocidade IA × IA
                  <select
                    aria-label="Velocidade IA × IA"
                    value={s.aiDelay}
                    onChange={(e) =>
                      s.configure({ aiDelay: Number(e.target.value) })
                    }
                  >
                    <option value={1200}>Contemplativa</option>
                    <option value={500}>Normal</option>
                    <option value={0}>Acelerada · sem animações</option>
                  </select>
                </label>
                <button
                  onClick={s.step}
                  disabled={
                    s.running || s.thinking || s.visualPending || !!s.result
                  }
                >
                  Avançar um lance de IA
                </button>
              </div>
            )}
            <div
              className={`panel analysis-panel ${panel !== "analysis" ? "mobile-panel-hidden" : ""}`}
            >
              <label>
                Dificuldade
                <select
                  aria-label="Dificuldade"
                  value={
                    s.search.depth === 1 &&
                    s.search.timeMs === 150 &&
                    s.search.simulations === 8
                      ? "easy"
                      : s.search.depth === 3 &&
                          s.search.timeMs === 450 &&
                          s.search.simulations === 24
                        ? "normal"
                        : s.search.depth === 4 &&
                            s.search.timeMs === 1200 &&
                            s.search.simulations === 64
                          ? "deep"
                          : "manual"
                  }
                  onChange={(e) => {
                    const levels = {
                      easy: { depth: 1, timeMs: 150, simulations: 8 },
                      normal: { depth: 3, timeMs: 450, simulations: 24 },
                      deep: { depth: 4, timeMs: 1200, simulations: 64 },
                    };
                    const level = levels[e.target.value as keyof typeof levels];
                    if (level)
                      s.configure({
                        search: { ...s.search, ...level },
                        running: false,
                      });
                  }}
                >
                  <option value="easy">Leve · busca curta</option>
                  <option value="normal">Normal · busca intermediária</option>
                  <option value="deep">Profunda · mais cálculo</option>
                  <option value="manual">Manual · controles abaixo</option>
                </select>
              </label>
              <div className="panel-heading">
                <span className="eyebrow">02 / INTELIGÊNCIA</span>
                <button
                  className="text-button"
                  onClick={() => void analyze()}
                  disabled={s.thinking}
                >
                  Analisar <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Busca
                  <select
                    value={model ? "mcts" : s.search.algorithm}
                    disabled={!!model}
                    onChange={(e) =>
                      s.configure({
                        search: {
                          ...s.search,
                          algorithm: e.target.value as "negamax" | "mcts",
                        },
                        running: false,
                      })
                    }
                  >
                    <option value="negamax">Negamax · alpha-beta</option>
                    <option value="mcts">MCTS · PUCT</option>
                  </select>
                </label>
                <label>
                  {model || s.search.algorithm === "mcts"
                    ? "Simulações"
                    : "Profundidade"}
                  <select
                    value={
                      model || s.search.algorithm === "mcts"
                        ? s.search.simulations
                        : s.search.depth
                    }
                    onChange={(e) =>
                      s.configure({
                        search: {
                          ...s.search,
                          ...(model || s.search.algorithm === "mcts"
                            ? { simulations: Number(e.target.value) }
                            : { depth: Number(e.target.value) }),
                        },
                        running: false,
                      })
                    }
                  >
                    {(model || s.search.algorithm === "mcts"
                      ? [8, 24, 64, 128]
                      : [1, 2, 3, 4, 5]
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="search-stats">
                <div>
                  <strong>
                    {s.analysis
                      ? s.analysis.scale === "centipawns"
                        ? `${(s.analysis.score / 100).toFixed(2)}`
                        : s.analysis.score.toFixed(3)
                      : "—"}
                  </strong>
                  <small>
                    {s.analysis?.scale === "value"
                      ? "Valor da posição"
                      : "Peões · lado a jogar"}
                  </small>
                </div>
                <div>
                  <strong>{s.analysis?.nodes.toLocaleString() ?? "—"}</strong>
                  <small>Nós avaliados</small>
                </div>
                <div>
                  <strong>
                    {s.analysis ? `${Math.round(s.analysis.timeMs)} ms` : "—"}
                  </strong>
                  <small>Tempo de busca</small>
                </div>
              </div>
              <p className="muted small">
                {model
                  ? model.completedBatches
                    ? "Policy/value neural local. Qualidade depende da avaliação competitiva."
                    : "Rede inicializada, sem treino. Pesos ainda não validados."
                  : "Avaliação por material, posição e mobilidade. Disponível sem modelo neural."}
              </p>
              <button
                onClick={() => void requestHint()}
                disabled={s.thinking || labBusy || reviewing}
              >
                Dica gradual
              </button>
              {currentHint && (
                <p className="notice">
                  {currentHint.stage === 1
                    ? `Considere a peça em ${currentHint.result.move?.from ?? "—"}.`
                    : currentHint.stage === 2
                      ? `Destino sugerido: ${currentHint.result.move?.to ?? "—"}.`
                      : `Linha calculada: ${currentHint.result.pv.join(" · ")}`}{" "}
                  A partida foi pausada para análise.
                </p>
              )}
              {s.analysis?.pv.length ? (
                <p className="pv">PV {s.analysis.pv.join(" · ")}</p>
              ) : null}
            </div>
            <div
              className={`panel history-panel ${panel !== "moves" ? "mobile-panel-hidden" : ""}`}
            >
              <div className="panel-heading">
                <span className="eyebrow">03 / JOGADAS</span>
                <span className="muted small">
                  {s.history.length} meias-jogadas
                </span>
              </div>
              <div className="move-list">
                {s.history.length ? (
                  Array.from(
                    { length: Math.ceil(s.history.length / 2) },
                    (_, i) => (
                      <div key={i}>
                        <span>{i + 1}.</span>
                        <b>
                          <button
                            aria-label={`Rever meia-jogada ${i * 2 + 1}`}
                            onClick={() => navigate(i * 2 + 1)}
                          >
                            {s.history[i * 2]}
                          </button>
                        </b>
                        <b>
                          {s.history[i * 2 + 1] ? (
                            <button
                              aria-label={`Rever meia-jogada ${i * 2 + 2}`}
                              onClick={() => navigate(i * 2 + 2)}
                            >
                              {s.history[i * 2 + 1]}
                            </button>
                          ) : (
                            ""
                          )}
                        </b>
                      </div>
                    ),
                  )
                ) : (
                  <p className="empty">A primeira jogada abre o caminho.</p>
                )}
              </div>
            </div>
          </aside>
        </details>
      </div>
      <div className="panel material-panel">
        <span>
          Saldo material:{" "}
          {summary.balance === 0
            ? "equilibrado"
            : `${summary.balance > 0 ? "+" : ""}${summary.balance} peões para as brancas`}
          . Peão = 1, cavalo/bispo = 3, torre = 5, dama = 9.
        </span>
        <div className="captured-pieces" aria-label="Peças capturadas">
          {summary.captured.map((p, i) => (
            <PieceSvg key={i} {...p} />
          ))}
        </div>
      </div>
      <section className="panel replay-controls" aria-label="Replay da partida">
        <button aria-label="Primeira posição" onClick={() => navigate(0)}>
          Início
        </button>
        <button
          aria-label="Posição anterior"
          onClick={() => navigate((cursor ?? s.history.length) - 1)}
        >
          Anterior
        </button>
        <button
          aria-label="Reproduzir replay"
          onClick={() => {
            if (cursor === null || cursor >= s.history.length) navigate(0);
            setPlayingReplay(!playingReplay);
          }}
        >
          {playingReplay ? "Pausar replay" : "Reproduzir replay"}
        </button>
        <button
          aria-label="Próxima posição"
          onClick={() => navigate((cursor ?? 0) + 1)}
        >
          Próxima
        </button>
        <button
          aria-label="Última posição"
          onClick={() => navigate(s.history.length)}
        >
          Final
        </button>
        <label>
          Velocidade do replay
          <select
            aria-label="Velocidade do replay"
            value={replaySpeed}
            onChange={(e) => setReplaySpeed(Number(e.target.value))}
          >
            <option value={1600}>0,5×</option>
            <option value={800}>1×</option>
            <option value={400}>2×</option>
            <option value={200}>4×</option>
          </select>
        </label>
        {reviewing && (
          <>
            <button
              onClick={() => {
                setCursor(null);
                setPlayingReplay(false);
              }}
            >
              Sair da revisão
            </button>
            <button
              onClick={() => {
                void s.save().then(() => {
                  if (useGame.getState().error) return;
                  s.load(s.initialFen, review.pgn);
                  setCursor(null);
                  setPlayingReplay(false);
                });
              }}
            >
              Experimentar continuação separada
            </button>
          </>
        )}
        <p className="description">
          Cada movimento de um lado é uma meia-jogada. A revisão preserva a
          partida e o resultado originais.
        </p>
      </section>
      <GameReview
        key={`${s.gameId}:${s.pgn}`}
        initialFen={s.initialFen}
        pgn={s.pgn}
        onNavigate={navigate}
        disabled={labBusy || s.running}
      />
      <div className="fen-row">
        <label htmlFor="fen-input">EXPLORAR UMA POSIÇÃO</label>
        <input
          id="fen-input"
          value={fen}
          onChange={(e) => setFen(e.target.value)}
          placeholder="Cole uma posição FEN"
        />
        <button
          onClick={() => {
            setCursor(null);
            setPlayingReplay(false);
            s.load(fen);
          }}
        >
          Carregar <RotateCw size={14} />
        </button>
      </div>
      {(s.error || toast) && (
        <div role="status" className={s.error ? "notice error" : "notice"}>
          {s.error ?? toast}
          <button
            className="text-button"
            onClick={() => {
              setToast("");
              useGame.setState({ error: null });
            }}
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
