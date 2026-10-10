"use client";
import { useEffect, useRef, useState } from "react";
import type { ReviewPoint } from "@/services/games/review";
export function GameReview({
  initialFen,
  pgn,
  onNavigate,
  disabled,
}: {
  initialFen: string;
  pgn: string;
  onNavigate: (ply: number) => void;
  disabled: boolean;
}) {
  const worker = useRef<Worker | null>(null);
  const [points, setPoints] = useState<ReviewPoint[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => () => worker.current?.terminate(), [initialFen, pgn]);
  const run = () => {
    worker.current?.terminate();
    setPoints([]);
    setBusy(true);
    setMessage("Analisando posições comparáveis…");
    const next = new Worker(
      new URL("../workers/review.worker.ts", import.meta.url),
    );
    worker.current = next;
    next.onmessage = (
      event: MessageEvent<{
        point?: ReviewPoint;
        total?: number;
        done?: boolean;
        error?: string;
      }>,
    ) => {
      if (worker.current !== next) return;
      if (event.data.point) {
        const point = event.data.point;
        setPoints((old) => [...old, point]);
        setMessage(`${point.ply + 1}/${event.data.total} posições calculadas.`);
      }
      if (event.data.done || event.data.error) {
        setBusy(false);
        setMessage(event.data.error ?? "Revisão concluída.");
        next.terminate();
        worker.current = null;
      }
    };
    next.onerror = () => {
      next.terminate();
      worker.current = null;
      setBusy(false);
      setMessage("Não foi possível concluir a revisão.");
    };
    next.postMessage({ initialFen, pgn });
  };
  const biggest = points
    .slice(1)
    .map((point, i) => ({ point, delta: point.score - points[i].score }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);
  return (
    <section className="panel review-analysis">
      <h2 className="section-title">Revisão calculada</h2>
      <p className="description">
        Perspectiva fixa: valores positivos favorecem as brancas. Motor
        heurístico, profundidade 2, até 150 ms por posição. Sem precisão ou
        rótulos de erro inventados.
      </p>
      <button disabled={busy || disabled || !pgn} onClick={run}>
        Calcular revisão
      </button>
      {busy && (
        <button
          onClick={() => {
            worker.current?.terminate();
            worker.current = null;
            setBusy(false);
            setMessage("Revisão cancelada; posições calculadas preservadas.");
          }}
        >
          Cancelar revisão
        </button>
      )}
      <p role="status" className="description">
        {message}
      </p>
      {points.length > 0 && (
        <>
          <svg
            className="chart"
            viewBox="0 0 600 140"
            role="img"
            aria-label="Avaliação por posição, em peões, perspectiva das brancas"
          >
            <path d="M0 70H600" stroke="#677572" />
            <polyline
              fill="none"
              stroke="#c5a56f"
              strokeWidth="2"
              points={points
                .map(
                  (p, i) =>
                    `${(i / Math.max(1, points.length - 1)) * 600},${70 - Math.max(-8, Math.min(8, p.score)) * 7}`,
                )
                .join(" ")}
            />
          </svg>
          <p className="description">
            O gráfico limita a escala visual a ±8 peões; os valores completos
            aparecem abaixo.
          </p>
          <div className="review-points">
            {biggest.map(({ point, delta }) => (
              <button key={point.ply} onClick={() => onNavigate(point.ply)}>
                {point.ply}ª meia-jogada · Δ {delta.toFixed(2)} ·{" "}
                {point.score.toFixed(2)} peões
              </button>
            ))}
          </div>
          <details>
            <summary>Jogada feita, sugestão e linhas calculadas</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Posição</th>
                    <th>Feita</th>
                    <th>Sugerida</th>
                    <th>Brancas</th>
                    <th>Linha / alternativas</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.ply}>
                      <td>
                        <button onClick={() => onNavigate(p.ply)}>
                          {p.ply}
                        </button>
                      </td>
                      <td>{p.san ?? "Final"}</td>
                      <td>{p.suggested ?? "—"}</td>
                      <td>{p.score.toFixed(2)}</td>
                      <td>
                        {p.pv.join(" · ")}
                        <br />
                        {p.alternatives.map((a) => a.san).join(" / ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
