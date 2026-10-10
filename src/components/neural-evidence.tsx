"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLab } from "@/stores/lab";
import { useGame } from "@/stores/game";
import { storage } from "@/services/storage/database";
import type { StoredGame, EvaluationRecord } from "@/types/domain";
function conditionsKey(record: EvaluationRecord) {
  const c = record.conditions;
  return c
    ? `${c.opponentHash}:${c.reference}:${c.simulations}:${c.maxPlies}:${c.games}`
    : null;
}
export function NeuralEvidence() {
  const lab = useLab(),
    router = useRouter();
  const [games, setGames] = useState<StoredGame[]>([]),
    [personal, setPersonal] = useState({ games: 0, examples: 0 }),
    [a, setA] = useState(""),
    [b, setB] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([storage.games(), storage.replay()])
      .then(([saved, replay]) => {
        if (!active) return;
        const samples = replay.filter((e) => e.origin === "human-consented");
        setGames(saved);
        setPersonal({
          games: new Set(samples.map((e) => e.gameId)).size,
          examples: samples.length,
        });
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar as evidências locais.");
      });
    return () => {
      active = false;
    };
  }, [lab.busy, lab.experiment?.id, lab.evaluation?.id]);
  const first = lab.models.find((m) => m.id === a),
    second = lab.models.find((m) => m.id === b);
  const left = first?.evaluations
    .slice()
    .reverse()
    .find(
      (r) =>
        !!conditionsKey(r) &&
        second?.evaluations.some((s) => conditionsKey(s) === conditionsKey(r)),
    );
  const right = left
    ? second?.evaluations
        .slice()
        .reverse()
        .find((r) => conditionsKey(r) === conditionsKey(left))
    : undefined;
  const records = [left, right].filter((r) => r !== undefined),
    ids = records.flatMap((r) => r.gameIds ?? []);
  return (
    <section className="panel">
      <h2 className="section-title">Evidência e comparação de gerações</h2>
      <p className="description">
        Replay pessoal consentido: {personal.games} partidas distintas e{" "}
        {personal.examples} exemplos atualmente preservados.{" "}
        {personal.games < 2
          ? "Ainda não há duas partidas pessoais para separar treino e validação por jogo."
          : "A divisão de treino/validação é feita por partida, junto ao self-play."}
      </p>
      <p className="description">
        O treinamento cria uma candidata e preserva o campeão. Queda de loss não
        comprova melhora no xadrez.
      </p>
      <div className="form-grid">
        {[
          [a, setA, "Geração A"],
          [b, setB, "Geração B"],
        ].map(([value, setter, label]) => (
          <label key={String(label)}>
            {String(label)}
            <select
              aria-label={String(label)}
              value={String(value)}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
            >
              <option value="">Selecione</option>
              {lab.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · geração {m.generation}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {left && right ? (
        <>
          <p className="description">
            Mesma referência ({left.conditions!.reference}),{" "}
            {left.conditions!.games} partidas, {left.conditions!.simulations}{" "}
            simulações e limite de {left.conditions!.maxPlies} meias-jogadas.
            Cores alternadas em ambas as amostras.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Vitórias</th>
                  <th>Empates</th>
                  <th>Derrotas</th>
                  <th>Pontos</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i === 0 ? first?.name : second?.name}</td>
                    <td>{r.wins}</td>
                    <td>{r.draws}</td>
                    <td>{r.losses}</td>
                    <td>{(r.points * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="review-points">
            {games
              .filter((g) => ids.includes(g.id))
              .map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    void useGame
                      .getState()
                      .save()
                      .then(() => {
                        if (useGame.getState().error) return;
                        useGame.getState().load(g.initialFen, g.pgn, g.result);
                        router.push("/");
                      });
                  }}
                >
                  Assistir: {g.white} × {g.black} · {g.result?.result}
                </button>
              ))}
          </div>
        </>
      ) : (
        <p className="description">
          Selecione dois modelos com avaliações registradas sob as mesmas
          condições. Use a mesma referência, número de partidas, simulações e
          limite de jogadas; avaliações antigas sem condições registradas não
          são tratadas como equivalentes.
        </p>
      )}
      {lab.evaluation && (
        <p className="description">
          Decisão da avaliação:{" "}
          {lab.evaluation.promoted
            ? "Promoção aprovada pelas condições competitivas."
            : (lab.evaluation.rejectionReason ??
              "Sem promoção; consulte pontuação, Wilson e referência.")}
        </p>
      )}
      {error && <p role="status">{error}</p>}
    </section>
  );
}
