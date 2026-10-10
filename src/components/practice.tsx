"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol } from "chess.js";
import { loadGame, gameResult } from "@/engine/chess/rules";
import { EXERCISES } from "@/services/games/exercises";
import { EngineClient } from "@/services/games/engine-client";
import { positionSummary } from "@/services/games/presentation";
import { usePreferences } from "@/stores/preferences";
import { Board2D } from "./board-2d";
import { useBoardMotion } from "./use-board-motion";
import { PieceSvg } from "./piece-svg";
export function Practice() {
  const prefs = usePreferences((s) => s.value),
    engine = useRef<EngineClient | null>(null);
  const [exerciseId, setExerciseId] = useState<string>(EXERCISES[0].id),
    [initialFen, setInitialFen] = useState<string>(EXERCISES[0].fen),
    [pgn, setPgn] = useState(""),
    [input, setInput] = useState(""),
    [selected, setSelected] = useState<Square | null>(null),
    [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(
      null,
    ),
    [message, setMessage] = useState(""),
    [thinking, setThinking] = useState(false),
    [session, setSession] = useState(0);
  const c = useMemo(() => loadGame(initialFen, pgn), [initialFen, pgn]),
    human = new Chess(initialFen).turn(),
    exercise = EXERCISES.find((e) => e.id === exerciseId);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration =
    reduced || prefs.animation === "off"
      ? 0
      : prefs.animation === "fast"
        ? 120
        : prefs.animationDuration;
  const motion = useBoardMotion(
      initialFen,
      pgn,
      `practice-${session}`,
      duration,
    ),
    summary = positionSummary(initialFen, pgn);
  useEffect(() => {
    engine.current = new EngineClient();
    return () => engine.current?.cancel();
  }, []);
  useEffect(() => {
    if (c.turn() === human || gameResult(c) || exercise?.goal === "mate-one")
      return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => setThinking(true));
    void engine.current
      ?.search({
        fen: c.fen(),
        pgn,
        config: {
          algorithm: "negamax",
          depth: 2,
          timeMs: 250,
          simulations: 16,
          seed: 42,
        },
      })
      .then((result) => {
        if (!cancelled && result.move) {
          const next = loadGame(initialFen, pgn);
          next.move(result.move);
          setPgn(next.pgn());
          setThinking(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setThinking(false);
          if (error.message !== "SEARCH_CANCELLED")
            setMessage("Não foi possível concluir a resposta do motor.");
        }
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      engine.current?.cancel();
    };
  }, [c, human, pgn, initialFen, exercise]);
  const reset = () => {
    engine.current?.cancel();
    setPgn("");
    setSelected(null);
    setPromotion(null);
    setThinking(false);
    setMessage("");
    setSession((n) => n + 1);
  };
  const move = (from: Square, to: Square, piece?: PieceSymbol) => {
    try {
      const next = loadGame(initialFen, pgn);
      next.move({ from, to, ...(piece ? { promotion: piece } : {}) });
      setPgn(next.pgn());
      setSelected(null);
      setPromotion(null);
      if (exercise?.goal === "mate-one")
        setMessage(
          next.isCheckmate()
            ? "Resolvido: xeque-mate verificado pelas regras."
            : "Essa jogada não é mate. Reinicie e tente outra continuação.",
        );
    } catch {
      setMessage("Escolha uma jogada legal.");
    }
  };
  const select = (square: Square) => {
    if (thinking || c.turn() !== human || gameResult(c)) return;
    const moves = c
      .moves({ verbose: true })
      .filter((m) => m.from === selected && m.to === square);
    if (moves.length && selected) {
      if (moves.some((m) => m.promotion))
        setPromotion({ from: selected, to: square });
      else move(selected, square);
    } else setSelected(c.get(square)?.color === c.turn() ? square : null);
  };
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">POSITION WORKSHOP</div>
          <h1>
            Uma posição, <em>um desafio.</em>
          </h1>
          <p>
            Exercícios separados da Arena: sua partida e seus relógios são
            preservados.
          </p>
        </div>
      </section>
      <div className="content-grid">
        <section className="board-section">
          <div className="board-top">
            <span>
              {thinking
                ? "Motor pensando…"
                : (gameResult(c)?.reason ?? "Sua vez")}
            </span>
            <span>ACCESSIBLE 2D</span>
          </div>
          <div className="board-stage">
            <Board2D
              fen={c.fen()}
              initialFen={initialFen}
              pgn={pgn}
              pieces={motion.pieces}
              duration={duration}
              appearance={prefs.appearance}
              selected={selected}
              legal={
                selected
                  ? c
                      .moves({ square: selected, verbose: true })
                      .map((m) => m.to)
                  : []
              }
              onSelect={select}
              flipped={human === "b"}
              last={summary.last}
              check={summary.check}
            />
            {promotion && (
              <div className="promotion">
                <p>Escolha a promoção</p>
                {(["q", "r", "b", "n"] as const).map((type) => (
                  <button
                    key={type}
                    aria-label={`Promover para ${type}`}
                    onClick={() => move(promotion.from, promotion.to, type)}
                  >
                    <PieceSvg type={type} color={human} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <label>
            Exercício
            <select
              aria-label="Exercício"
              value={exerciseId}
              onChange={(event) => {
                const chosen = EXERCISES.find(
                  (e) => e.id === event.target.value,
                );
                if (chosen) {
                  reset();
                  setExerciseId(chosen.id);
                  setInitialFen(chosen.fen);
                }
              }}
            >
              {EXERCISES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
              {exerciseId === "custom" && (
                <option value="custom">FEN personalizada</option>
              )}
            </select>
          </label>
          <p className="description">
            {exercise?.description ??
              "Continue a posição contra o motor heurístico."}
          </p>
          <button onClick={reset}>Reiniciar exercício</button>
          {exercise?.solution && (
            <details>
              <summary>Mostrar uma solução verificada</summary>
              <p>{exercise.solution}</p>
            </details>
          )}
          <label>
            Posição FEN
            <input
              aria-label="FEN de exercício"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <button
            onClick={() => {
              try {
                const position = new Chess(input);
                reset();
                setExerciseId("custom");
                setInitialFen(position.fen());
              } catch {
                setMessage("FEN inválida. O exercício atual foi preservado.");
              }
            }}
          >
            Carregar exercício FEN
          </button>
          <p role="status" className="notice">
            {message ||
              gameResult(c)?.reason ||
              "Escolha uma peça e o destino."}
          </p>
          <p className="description">
            Posições autorais e soluções verificadas com chess.js. Licença MIT;
            nenhum conjunto externo foi importado.
          </p>
        </section>
      </div>
    </>
  );
}
