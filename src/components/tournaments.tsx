"use client";
import { useState } from "react";
import Link from "next/link";
import { useLab } from "@/stores/lab";
export function Tournaments() {
  const lab = useLab(),
    [ids, setIds] = useState<string[]>([]),
    [plies, setPlies] = useState(80);
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">ROUND-ROBIN / LOCAL</div>
          <h1>
            Encontros que geram <em>evidência.</em>
          </h1>
          <p>
            Cores alternadas, partidas salvas e classificação calculada no
            tabuleiro.
          </p>
        </div>
        <Link href="/lab" className="text-link">
          Voltar ao laboratório
        </Link>
      </section>
      <div className="content-grid">
        <section className="panel">
          <h2 className="section-title">Participantes</h2>
          <p className="description">
            Selecione de 2 a 4 modelos. Cada par joga nas duas cores. O torneio
            não promove modelos automaticamente.
          </p>
          {lab.models.map((m) => (
            <div className="settings-row" key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <p>
                  {m.completedBatches} lotes · {m.status}
                </p>
              </div>
              <input
                type="checkbox"
                aria-label={m.name}
                checked={ids.includes(m.id)}
                disabled={lab.busy || (!ids.includes(m.id) && ids.length >= 4)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, m.id]
                      : ids.filter((id) => id !== m.id),
                  )
                }
              />
            </div>
          ))}
          <label className="section-gap">
            Orçamento de meias-jogadas
            <input
              type="number"
              min={16}
              max={240}
              value={plies}
              onChange={(e) => setPlies(Number(e.target.value))}
            />
          </label>
          <button
            className="primary section-gap"
            disabled={ids.length < 2 || lab.busy}
            onClick={() => lab.tournament(ids, 8, plies)}
          >
            Iniciar torneio
          </button>
          {lab.busy && (
            <div className="button-row section-gap">
              <button onClick={lab.paused ? lab.resume : lab.pause}>
                {lab.paused ? "Continuar" : "Pausar"}
              </button>
              <button onClick={lab.cancel}>Cancelar</button>
            </div>
          )}
          <div className="busy-line section-gap" role="status">
            {lab.message}
          </div>
          {lab.error && (
            <p role="alert" className="danger">
              {lab.error}
            </p>
          )}
        </section>
        <div className="stack">
          {lab.tournaments.length ? (
            lab.tournaments.map((t) => (
              <section key={t.id} className="panel">
                <div className="panel-heading">
                  <span className="eyebrow">{t.name}</span>
                  <span className="tag">{t.status}</span>
                </div>
                <div className="table-scroll">
                  <table className="game-table">
                    <thead>
                      <tr>
                        <th>MODELO</th>
                        <th>V</th>
                        <th>E</th>
                        <th>D</th>
                        <th>PONTOS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...t.standings]
                        .sort((a, b) => b.points - a.points)
                        .map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td>{row.wins}</td>
                            <td>{row.draws}</td>
                            <td>{row.losses}</td>
                            <td>{row.points}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="description">
                  {t.matches.length}/
                  {t.participants.length * (t.participants.length - 1)} partidas
                  registradas. Limite: {t.maxPlies} meias-jogadas; posições
                  inacabadas são empates adjudicados.
                </p>
                <Link className="text-link" href="/games">
                  Revisar partidas na biblioteca
                </Link>
              </section>
            ))
          ) : (
            <section className="panel empty">
              Os resultados aparecem após as primeiras partidas.
            </section>
          )}
        </div>
      </div>
    </>
  );
}
