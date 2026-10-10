"use client";
import { useEffect, useState } from "react";
import { storage } from "@/services/storage/database";
import type { StoredGame } from "@/types/domain";
import { Chess } from "chess.js";
export function RemoteSettings() {
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    void fetch("/api/remote/status")
      .then((r) => r.json())
      .then((data) => {
        if (alive) setEnabled(data.enabled === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const request = async (path: string, method = "POST", data?: unknown) => {
    const r = await fetch(`/api/remote/${path}`, {
      method,
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "Falha remota.");
    return body;
  };
  const action = async (kind: "backup" | "restore" | "delete") => {
    setBusy(true);
    setMessage("");
    try {
      await request("session");
      if (kind === "backup") {
        const [games, models] = await Promise.all([
          storage.games(),
          storage.models(),
        ]);
        for (const game of games.slice(0, 10))
          await request("backup", "POST", { game });
        for (const m of models.slice(0, 10))
          await request("backup", "POST", {
            model: {
              id: m.id,
              name: m.name,
              hash: m.checkpoint.hash,
              generation: m.generation,
              completedBatches: m.completedBatches,
              preset: m.preset,
            },
          });
        setMessage(
          `Enviadas ${Math.min(games.length, 10)} partidas e ${Math.min(models.length, 10)} fichas de modelos. Pesos ficam locais.`,
        );
      }
      if (kind === "restore") {
        const data = await request("backup", "GET");
        let count = 0;
        for (const g of data.games as StoredGame[]) {
          const c = new Chess(g.initialFen);
          c.loadPgn(g.pgn, { strict: true });
          await storage.saveGame(g);
          count++;
        }
        setMessage(
          `${count} partidas restauradas. Metadados de modelos não contêm os pesos.`,
        );
      }
      if (kind === "delete") {
        await request("backup", "DELETE");
        setMessage(
          "Backup remoto da sua sessão excluído. Arquivo local preservado.",
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha remota.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <span className="eyebrow">MODO REMOTO OPCIONAL</span>
        <span className="tag">{enabled ? "CONFIGURADO" : "DESATIVADO"}</span>
      </div>
      <h2 className="section-title">Todo o jogo, aqui.</h2>
      <p className="description">
        {enabled
          ? "Backup privado de PGNs e fichas de modelos, vinculado a uma sessão assinada de 30 dias neste navegador."
          : "Esta implantação usa armazenamento local. O backup PostgreSQL pode ser ativado com DATABASE_URL, AUTH_SECRET e migrações; não é necessário para jogar ou treinar."}
      </p>
      <p className="description">
        Pesos não são enviados ao banco. A sessão não oferece login entre
        dispositivos; perder o cookie impede recuperar o backup. Treinamento
        distribuído não está habilitado.
      </p>
      {enabled && (
        <div className="stack">
          <button disabled={busy} onClick={() => void action("backup")}>
            Enviar 10 partidas e 10 fichas recentes
          </button>
          <button disabled={busy} onClick={() => void action("restore")}>
            Restaurar partidas da sessão
          </button>
          <button
            disabled={busy}
            className="danger"
            onClick={() => void action("delete")}
          >
            Excluir backup remoto
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="description">
          {message}
        </p>
      )}
    </section>
  );
}
