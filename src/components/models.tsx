"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, Upload, Trash2, ArrowUpRight } from "lucide-react";
import { useLab } from "@/stores/lab";
import { useGame } from "@/stores/game";
import { storage } from "@/services/storage/database";
import { parseModel } from "@/services/models/validation";
import { download } from "@/services/storage/download";
export function Models() {
  const lab = useLab(),
    [error, setError] = useState("");
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">LOCAL MODEL REGISTRY</div>
          <h1>
            Versões de <em>uma inteligência.</em>
          </h1>
          <p>Pesos, histórico e evidência. Cada candidata tem sua origem.</p>
        </div>
        <Link className="text-link" href="/lab">
          Criar no laboratório <ArrowUpRight size={17} />
        </Link>
      </section>
      <div
        className="button-row"
        style={{ justifyContent: "flex-start", marginBottom: 25 }}
      >
        <label className="upload">
          <Upload size={15} /> Importar checkpoint
          <input
            className="file-input"
            type="file"
            accept="application/json,.json"
            disabled={lab.busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 10 * 1024 * 1024)
                  throw new Error("Arquivo excede 10 MiB.");
                lab.importModel(parseModel(await file.text()));
                setError("");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Modelo inválido.",
                );
              }
              e.target.value = "";
            }}
          />
        </label>
        <span className="description">
          JSON com hash SHA-256, arquitetura e estado do otimizador.
        </span>
      </div>
      {!lab.models.length ? (
        <section className="panel empty">
          <h2 className="section-title">Um registro pronto para começar.</h2>
          <p>
            Crie uma rede no Neural Lab. Seus modelos ficam neste navegador até
            você exportá-los.
          </p>
          <Link
            className="text-link"
            style={{ justifyContent: "center" }}
            href="/lab"
          >
            Inicializar primeira rede <ArrowUpRight size={15} />
          </Link>
        </section>
      ) : (
        <div className="model-list">
          {lab.models.map((m) => (
            <article key={m.id} className="panel model-card">
              <div className="panel-heading">
                <span className="eyebrow">
                  {m.preset.toUpperCase()} / G{m.generation}
                </span>
                <span className="tag">
                  {m.status === "champion"
                    ? "CAMPEÃO"
                    : m.status === "archived"
                      ? "ARQUIVADO"
                      : m.completedBatches
                        ? "CANDIDATA"
                        : "SEM TREINO"}
                </span>
              </div>
              <h2>{m.name}</h2>
              <p className="parameter">
                {m.parameters.toLocaleString("pt-BR")} parâmetros · {m.origin}
              </p>
              <dl>
                <div>
                  <dt>Atualizações reais</dt>
                  <dd>{m.completedBatches} lotes</dd>
                </div>
                <div>
                  <dt>Arquitetura</dt>
                  <dd>Policy / Value CNN</dd>
                </div>
                <div>
                  <dt>Avaliações</dt>
                  <dd>{m.evaluations.length}</dd>
                </div>
                <div>
                  <dt>Criado</dt>
                  <dd>{new Date(m.createdAt).toLocaleDateString("pt-BR")}</dd>
                </div>
              </dl>
              {m.evaluations.at(-1) && (
                <p className="description">
                  Última amostra: {m.evaluations.at(-1)!.games} partidas ·{" "}
                  {(m.evaluations.at(-1)!.points * 100).toFixed(1)}% dos pontos.
                </p>
              )}
              <p className="muted small" title={m.checkpoint.hash}>
                SHA-256 {m.checkpoint.hash.slice(0, 20)}…
              </p>
              <div className="button-row">
                {m.status === "archived" &&
                  m.evaluations.some((e) => e.promoted) && (
                    <button
                      disabled={lab.busy}
                      onClick={() =>
                        void storage
                          .rollback(
                            m.id,
                            lab.models.find((m) => m.status === "champion")
                              ?.id ?? null,
                          )
                          .then(lab.refresh)
                          .catch((err) => setError(String(err)))
                      }
                    >
                      Restaurar campeão
                    </button>
                  )}
                <Link
                  className="upload"
                  href="/"
                  onClick={() =>
                    useGame
                      .getState()
                      .configure({ modelId: m.id, running: false })
                  }
                >
                  Jogar
                </Link>
                <button
                  aria-label={`Exportar ${m.name}`}
                  onClick={() =>
                    download(
                      `${m.name.replace(/[^a-z0-9]/gi, "-")}.json`,
                      JSON.stringify(m),
                    )
                  }
                >
                  <Download size={14} />
                </button>
                <button
                  aria-label={`Excluir ${m.name}`}
                  disabled={lab.busy || m.status === "champion"}
                  onClick={() =>
                    void storage
                      .deleteModel(m.id)
                      .then(() => lab.refresh())
                      .catch((err) => setError(String(err)))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {(error || lab.error) && (
        <div className="notice error" role="alert">
          {error || lab.error}
        </div>
      )}
      <p className="description section-gap">
        A seleção manual de um modelo não muda o campeão validado. Modelos
        importados precisam de nova avaliação. Exporte antes de limpar os dados
        do navegador.
      </p>
    </>
  );
}
