"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, Component, type ReactNode } from "react";
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
import { Board2D } from "./board-2d";
import { EngineClient } from "@/services/games/engine-client";
const Board3D = dynamic(() => import("./board-3d"), {
  ssr: false,
  loading: () => <div className="loading-board">Preparando o tabuleiro…</div>,
});
class BoardBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function Arena() {
  const s = useGame(),
    prefs = usePreferences((st) => st.value),
    models = useLab((st) => st.models),
    client = useRef<EngineClient | null>(null);
  const [flip, setFlip] = useState(false),
    [fen, setFen] = useState(""),
    [toast, setToast] = useState(""),
    [gpu, setGpu] = useState<boolean | null>(null);
  const turn = new Chess(s.fen).turn(),
    engineId = s.mode === "ai" && turn === "b" ? s.blackModelId : s.modelId,
    model = models.find((m) => m.id === engineId);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    requestAnimationFrame(() => setGpu(!!gl));
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    client.current = new EngineClient();
    void useGame.getState().hydrate();
    const timer = setInterval(() => useGame.getState().tick(), 1000);
    return () => {
      clearInterval(timer);
      client.current?.cancel();
    };
  }, []);
  useEffect(() => {
    const state = useGame.getState(),
      c = new Chess(state.fen);
    if (
      !state.running ||
      state.result ||
      state.mode === "local" ||
      (state.mode === "human" && c.turn() === state.human)
    )
      return;
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
    const delay = setTimeout(() => {
      void client.current
        ?.search({
          fen: state.fen,
          pgn: state.pgn,
          config: model ? { ...state.search, algorithm: "mcts" } : state.search,
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
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(delay);
      client.current?.cancel();
      useGame.setState({ thinking: false });
    };
  }, [s.revision, s.fen, model, engineId]);
  const analyze = async () => {
    if (!client.current || s.thinking) return;
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
      if (useGame.getState().revision === revision)
        useGame.setState({ analysis: result, thinking: false });
    } catch (error) {
      useGame.setState({
        thinking: false,
        error: error instanceof Error ? error.message : "Falha de análise.",
      });
    }
  };
  const boardProps = {
    initialFen: s.initialFen,
    pgn: s.pgn,
    fen: s.fen,
    selected: s.selected,
    legal: prefs.hints ? s.legal : [],
    onSelect: (square: Square) => s.select(square),
    flipped: flip,
  };
  return (
    <div className="arena-page">
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
        <section className="board-section">
          <div className="board-top">
            <span>
              <span className="status-dot" />
              {s.result
                ? s.result.reason
                : s.thinking
                  ? "Motor pensando…"
                  : turn === "w"
                    ? "Brancas a jogar"
                    : "Pretas a jogar"}
            </span>
            <span>
              {prefs.board === "3d" && gpu ? "REALTIME 3D" : "ACCESSIBLE 2D"}
            </span>
          </div>
          <div className="board-stage">
            {prefs.board === "2d" || gpu === false ? (
              <Board2D {...boardProps} />
            ) : gpu === null ? (
              <div className="loading-board">Preparando o tabuleiro…</div>
            ) : (
              <BoardBoundary fallback={<Board2D {...boardProps} />}>
                <Board3D
                  {...boardProps}
                  top={prefs.camera === "top"}
                  graphics={prefs.graphics}
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
                    {["♕", "♖", "♗", "♘"][i]}
                  </button>
                ))}
              </div>
            )}
            {s.result && (
              <div className="result-banner">
                <strong>{s.result.result}</strong>
                <span>{s.result.reason}</span>
              </div>
            )}
          </div>
          <div className="board-toolbar">
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
              {prefs.board === "3d"
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
        <aside className="arena-sidebar">
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
              <span className="piece-icon">♚</span>
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
                    : (models.find(
                        (m) =>
                          m.id ===
                          (s.mode === "ai" ? s.blackModelId : s.modelId),
                      )?.name ?? "Motor heurístico")}
                </small>
              </div>
              <time>{clock(s.seconds.b)}</time>
            </div>
            <div className={`player-row ${turn === "w" ? "current" : ""}`}>
              <span className="piece-icon ivory">♔</span>
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
                    : (models.find((m) => m.id === s.modelId)?.name ??
                      "Motor heurístico")}
                </small>
              </div>
              <time>{clock(s.seconds.w)}</time>
            </div>
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
                  value={s.timeControl}
                  onChange={(e) =>
                    s.configure({
                      timeControl: Number(e.target.value),
                      running: false,
                    })
                  }
                >
                  <option value={300}>5 minutos</option>
                  <option value={600}>10 minutos</option>
                  <option value={1800}>30 minutos</option>
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
            <div className="button-row">
              <button
                className="primary"
                onClick={() => s.configure({ running: !s.running })}
              >
                {s.running ? <Pause size={15} /> : <Play size={15} />}{" "}
                {s.running ? "Pausar" : "Continuar"}
              </button>
              <button onClick={s.reset}>
                <RotateCcw size={15} /> Nova partida
              </button>
            </div>
          </div>
          <div className="panel analysis-panel">
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
            {s.analysis?.pv.length ? (
              <p className="pv">PV {s.analysis.pv.join(" · ")}</p>
            ) : null}
          </div>
          <div className="panel history-panel">
            <div className="panel-heading">
              <span className="eyebrow">03 / JOGADAS</span>
              <span className="muted small">{s.history.length} plies</span>
            </div>
            <div className="move-list">
              {s.history.length ? (
                Array.from(
                  { length: Math.ceil(s.history.length / 2) },
                  (_, i) => (
                    <div key={i}>
                      <span>{i + 1}.</span>
                      <b>{s.history[i * 2]}</b>
                      <b>{s.history[i * 2 + 1] ?? ""}</b>
                    </div>
                  ),
                )
              ) : (
                <p className="empty">A primeira jogada abre o caminho.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
      <div className="fen-row">
        <label htmlFor="fen-input">EXPLORAR UMA POSIÇÃO</label>
        <input
          id="fen-input"
          value={fen}
          onChange={(e) => setFen(e.target.value)}
          placeholder="Cole uma posição FEN"
        />
        <button onClick={() => s.load(fen)}>
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
