"use client";
import Link from "next/link";
import { useState } from "react";
import { Play, Pause, Square, ArrowUpRight, FlaskConical } from "lucide-react";
import { useLab } from "@/stores/lab";
import type { Preset, TrainingConfig } from "@/types/domain";
const defaults: TrainingConfig = {
  games: 2,
  simulations: 8,
  maxPlies: 48,
  epochs: 2,
  batchSize: 8,
  learningRate: 0.001,
  bufferCapacity: 512,
  checkpointEvery: 1,
};
function Curve({ values }: { values: number[] }) {
  if (!values.length)
    return (
      <div className="chart empty">
        As curvas aparecem após os primeiros gradientes reais.
      </div>
    );
  const max = Math.max(...values) * 1.05,
    min = Math.min(...values) * 0.95,
    points = values
      .map(
        (n, i) =>
          `${values.length === 1 ? 250 : (i / (values.length - 1)) * 500},${150 - ((n - min) / (max - min || 1)) * 130}`,
      )
      .join(" ");
  return (
    <svg
      className="chart"
      viewBox="0 0 500 170"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Loss dos ${values.length} lotes medidos, última ${values.at(-1)?.toFixed(4)}`}
    >
      <path
        d="M0 40H500 M0 90H500 M0 140H500"
        stroke="#2b3334"
        strokeWidth="1"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#b79b73"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      {values.length === 1 && <circle cx="250" cy="80" r="3" fill="#b79b73" />}
    </svg>
  );
}
export function Lab() {
  const lab = useLab(),
    [name, setName] = useState("Evo Tiny"),
    [preset, setPreset] = useState<Preset>("tiny"),
    [chosen, setChosen] = useState(""),
    [config, setConfig] = useState(defaults),
    [evaluationGames, setEvaluationGames] = useState(8),
    [opponent, setOpponent] = useState("");
  const selected = lab.models.find((m) => m.id === chosen) ?? lab.models[0],
    e = lab.experiment,
    last = e?.metrics.at(-1),
    metrics = e?.metrics ?? [];
  const update = (key: keyof TrainingConfig, value: number) =>
    setConfig({ ...config, [key]: value });
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">THE NEURAL WORKSHOP</div>
          <h1>
            Aprender é <em>experimentar.</em>
          </h1>
          <p>Self-play, gradientes reais e evidência antes da promoção.</p>
        </div>
        <Link className="text-link" href="/models">
          Registro de modelos <ArrowUpRight size={17} />
        </Link>
      </section>
      <div className="content-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-heading">
              <span className="eyebrow">01 / CRIAR UMA REDE</span>
              <FlaskConical size={18} color="#b79b73" />
            </div>
            <label>
              Nome
              <input
                value={name}
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Arquitetura
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as Preset)}
                >
                  <option value="tiny">Tiny · 8 canais, 1 bloco</option>
                  <option value="standard">
                    Standard · 16 canais, 2 blocos
                  </option>
                  <option value="research">
                    Research · 24 canais, 3 blocos
                  </option>
                </select>
              </label>
              <div className="muted small">
                8 × 8 × 20 entrada
                <br />
                4.672 ações + valor
              </div>
            </div>
            <button
              className="primary"
              disabled={lab.busy || !name.trim()}
              onClick={() => lab.createModel(name, preset)}
            >
              Inicializar modelo
            </button>
            <p className="description">
              Uma rede nova tem pesos inicializados, sem treino. Nenhuma força
              de jogo é presumida.
            </p>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="eyebrow">02 / SELF-PLAY & TREINO</span>
            </div>
            <label>
              Modelo de origem
              <select
                aria-label="Modelo de origem"
                value={selected?.id ?? ""}
                onChange={(e) => setChosen(e.target.value)}
              >
                <option value="" disabled>
                  Crie um modelo primeiro
                </option>
                {lab.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.completedBatches} lotes
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              {[
                ["games", "Partidas", 1, 8],
                ["simulations", "Simulações / jogada", 4, 128],
                ["maxPlies", "Limite de meias-jogadas", 8, 240],
                ["epochs", "Épocas", 1, 20],
                ["batchSize", "Tamanho do lote", 2, 32],
                ["bufferCapacity", "Capacidade de replay", 64, 4096],
              ].map(([key, label, min, max]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    aria-label={String(label)}
                    value={config[key as keyof TrainingConfig]}
                    min={Number(min)}
                    max={Number(max)}
                    onChange={(e) =>
                      update(
                        key as keyof TrainingConfig,
                        Number(e.target.value),
                      )
                    }
                  />
                </label>
              ))}
              <label>
                Learning rate
                <input
                  type="number"
                  value={config.learningRate}
                  min={0.00001}
                  max={0.01}
                  step={0.0001}
                  onChange={(e) =>
                    update("learningRate", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Checkpoint / lotes
                <select
                  value={config.checkpointEvery}
                  onChange={(e) =>
                    update("checkpointEvery", Number(e.target.value))
                  }
                >
                  {[1, 2, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="button-row">
              <button
                className="primary"
                disabled={lab.busy || !selected}
                onClick={() => {
                  setChosen("");
                  lab.train(selected!.id, config);
                }}
              >
                <Play size={14} /> Iniciar treino
              </button>
              {e && e.status !== "completed" && (
                <button
                  disabled={lab.busy}
                  onClick={() => {
                    setChosen(e.modelId);
                    lab.train(e.modelId, e.config, true);
                  }}
                >
                  Retomar checkpoint
                </button>
              )}
            </div>
            <p className="description">
              Cria uma nova candidata e preserva a origem. Partidas atingindo o
              limite são empates adjudicados. Sessão limitada a 10 minutos.
            </p>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="eyebrow">03 / AVALIAÇÃO COMPETITIVA</span>
            </div>
            <label>
              Referência
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
              >
                <option value="">Heurístico fixo</option>
                {lab.models
                  .filter((m) => m.id !== selected?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.status === "champion" ? " · campeão" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Partidas · cores alternadas
                <select
                  value={evaluationGames}
                  onChange={(e) => setEvaluationGames(Number(e.target.value))}
                >
                  {[2, 4, 8, 12, 16].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="description">
                Promoção: ≥ 8 partidas, ≥ 60% dos pontos, limite Wilson &gt;
                50%.
              </div>
            </div>
            <button
              disabled={lab.busy || !selected?.completedBatches}
              onClick={() =>
                lab.evaluate(
                  selected!.id,
                  evaluationGames,
                  config.simulations,
                  config.maxPlies,
                  opponent || undefined,
                )
              }
            >
              Avaliar candidata
            </button>
            <p className="description">
              Somente uma vitória convincente sobre o campeão atual permite
              promoção. Sem campeão, a referência é o heurístico.
            </p>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-heading">
              <span className="eyebrow">EXPERIMENTO EM OBSERVAÇÃO</span>
              <span className="tag">
                {lab.busy
                  ? lab.paused
                    ? "PAUSADO"
                    : "EXECUTANDO"
                  : (e?.status ?? "AGUARDANDO")}
              </span>
            </div>
            <div className="busy-line" role="status">
              {lab.busy && !lab.paused && <span className="spinner" />}
              {lab.message}
            </div>
            <div className="metric-grid">
              <div className="metric">
                <strong>{e?.completedGames ?? "—"}</strong>
                <span>Partidas concluídas</span>
              </div>
              <div className="metric">
                <strong>{metrics.length || "—"}</strong>
                <span>Lotes calculados</span>
              </div>
              <div className="metric">
                <strong>{last?.loss.toFixed(4) ?? "—"}</strong>
                <span>Loss total</span>
              </div>
              <div className="metric">
                <strong>{last?.validationLoss?.toFixed(4) ?? "—"}</strong>
                <span>Loss de validação</span>
              </div>
            </div>
            <div className="chart-label">
              <span>LOSS TOTAL / LOTE</span>
              <span>
                {lab.backend} ·{" "}
                {last
                  ? `${(last.memoryBytes / 1048576).toFixed(1)} MiB de tensores (estimativa)`
                  : "backend ainda não iniciado"}
              </span>
            </div>
            <Curve values={metrics.map((m) => m.loss)} />
            <div className="search-stats">
              <div>
                <strong>{last?.policyLoss.toFixed(4) ?? "—"}</strong>
                <small>Policy cross-entropy</small>
              </div>
              <div>
                <strong>{last?.valueLoss.toFixed(4) ?? "—"}</strong>
                <small>Value MSE</small>
              </div>
              <div>
                <strong>{last?.epoch ?? "—"}</strong>
                <small>Época</small>
              </div>
            </div>
            {lab.busy && (
              <div className="button-row">
                <button onClick={lab.paused ? lab.resume : lab.pause}>
                  {lab.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
                  {lab.paused ? "Continuar" : "Pausar"}
                </button>
                <button onClick={lab.cancel}>
                  <Square size={13} /> Cancelar
                </button>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <span className="eyebrow">REGISTRO DO EXPERIMENTO</span>
              <span className="muted small">Persistido localmente</span>
            </div>
            <div className="logs">
              {e?.logs.length ? (
                e.logs.map((log, i) => (
                  <p key={i}>
                    <time>{new Date(log.at).toLocaleTimeString("pt-BR")}</time>
                    {log.message}
                  </p>
                ))
              ) : (
                <p>
                  Nenhum experimento executado. Os registros serão gerados pelo
                  worker.
                </p>
              )}
            </div>
          </section>
          {lab.evaluation && (
            <section className="panel">
              <div className="panel-heading">
                <span className="eyebrow">RESULTADO DA AVALIAÇÃO</span>
                <span className="tag">
                  {lab.evaluation.promoted ? "PROMOVIDA" : "SEM PROMOÇÃO"}
                </span>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <strong>{lab.evaluation.wins}</strong>
                  <span>Vitórias</span>
                </div>
                <div className="metric">
                  <strong>{lab.evaluation.draws}</strong>
                  <span>Empates</span>
                </div>
                <div className="metric">
                  <strong>{lab.evaluation.losses}</strong>
                  <span>Derrotas</span>
                </div>
                <div className="metric">
                  <strong>{(lab.evaluation.points * 100).toFixed(1)}%</strong>
                  <span>Pontos</span>
                </div>
              </div>
              <p className="description">
                Limite inferior Wilson:{" "}
                {(lab.evaluation.lowerBound * 100).toFixed(1)}%. Elo relativo
                estimado:{" "}
                {lab.evaluation.eloDifference?.toFixed(0) ??
                  "indefinido na amostra"}
                . Estimativa local contra essa referência, sem rating oficial.
              </p>
            </section>
          )}
          <section className="panel">
            <h2 className="section-title">Da posição à experiência.</h2>
            <div className="architecture">
              <div>
                <strong>MCTS / PUCT</strong>Política legal
              </div>
              <span>→</span>
              <div>
                <strong>Self-play</strong>Resultado real
              </div>
              <span>→</span>
              <div>
                <strong>Policy + value</strong>Gradiente Adam
              </div>
            </div>
            <p className="description">
              A queda da loss não prova força no tabuleiro. Checkpoints são
              candidatas até vencerem a avaliação, com cores alternadas e
              amostra suficiente.
            </p>
          </section>
        </div>
      </div>
      {lab.error && (
        <div role="alert" className="notice error">
          {lab.error}
        </div>
      )}
    </>
  );
}
