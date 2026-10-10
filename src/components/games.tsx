"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Download, Play, Trash2, Upload } from "lucide-react";
import { storage } from "@/services/storage/database";
import { download } from "@/services/storage/download";
import { useGame } from "@/stores/game";
import { DEFAULT_POSITION, gameResult } from "@/engine/chess/rules";
import type { StoredGame } from "@/types/domain";
export function Games() {
  const [games, setGames] = useState<StoredGame[]>([]),
    [pgn, setPgn] = useState(""),
    [error, setError] = useState(""),
    router = useRouter();
  const refresh = async () => {
    try {
      setGames(await storage.games());
    } catch (err) {
      setError(String(err));
    }
  };
  useEffect(() => {
    let mounted = true;
    void storage
      .games()
      .then((g) => {
        if (mounted) setGames(g);
      })
      .catch((err) => {
        if (mounted) setError(String(err));
      });
    return () => {
      mounted = false;
    };
  }, []);
  const importPgn = async (text: string) => {
    try {
      if (new TextEncoder().encode(text).length > 1000000)
        throw new Error("PGN excede 1 MiB.");
      const c = new Chess();
      c.loadPgn(text, { strict: true });
      const h = c.getHeaders();
      await storage.saveGame({
        id: crypto.randomUUID(),
        name: h.Event ?? "Partida importada",
        pgn: c.pgn(),
        initialFen: h.FEN ?? DEFAULT_POSITION,
        createdAt: new Date().toISOString(),
        mode: "import",
        result: gameResult(c),
        white: h.White ?? "Brancas",
        black: h.Black ?? "Pretas",
        timeControl: h.TimeControl ?? "—",
        personalLearning: false,
      });
      setPgn("");
      setError("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PGN inválido.");
    }
  };
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">THE GAME ARCHIVE</div>
          <h1>
            Partidas que viram <em>história.</em>
          </h1>
          <p>
            Revisite decisões, exporte registros e preserve seus experimentos.
          </p>
        </div>
        <label className="upload">
          <Upload size={14} /> Importar PGN
          <input
            className="file-input"
            type="file"
            accept=".pgn,text/plain"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 1000000) setError("PGN excede 1 MiB.");
                else await importPgn(await f.text());
              }
              e.target.value = "";
            }}
          />
        </label>
      </section>
      <section className="panel table-scroll">
        {games.length ? (
          <table className="game-table">
            <thead>
              <tr>
                <th>PARTIDA</th>
                <th>JOGADORES</th>
                <th>RESULTADO</th>
                <th>ORIGEM</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.name}
                    <small>
                      {new Date(g.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </td>
                  <td>
                    {g.white}
                    <small>vs. {g.black}</small>
                  </td>
                  <td>
                    {g.result?.result ?? "*"}
                    <small>
                      {g.result?.reason ?? "Em andamento / importada"}
                    </small>
                  </td>
                  <td>
                    <span className="tag">{g.mode.toUpperCase()}</span>
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        aria-label={`Revisar ${g.name}`}
                        title="Revisar na arena"
                        onClick={() => {
                          useGame
                            .getState()
                            .load(g.initialFen, g.pgn, g.result);
                          useGame
                            .getState()
                            .configure({ mode: "local", running: false });
                          router.push("/");
                        }}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        aria-label={`Exportar ${g.name}`}
                        onClick={() =>
                          download(
                            `${g.id}.pgn`,
                            g.pgn,
                            "application/x-chess-pgn",
                          )
                        }
                      >
                        <Download size={14} />
                      </button>
                      <button
                        aria-label={`Excluir ${g.name}`}
                        onClick={() =>
                          void storage
                            .deleteGame(g.id)
                            .then(refresh)
                            .catch((err) => setError(String(err)))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <h2 className="section-title">Seu arquivo começa no tabuleiro.</h2>
            <p>
              Partidas da arena, self-play e avaliação serão guardadas aqui.
            </p>
          </div>
        )}
      </section>
      <section className="panel section-gap">
        <div className="panel-heading">
          <span className="eyebrow">IMPORTAR TEXTO PGN</span>
        </div>
        <textarea
          aria-label="Texto PGN"
          rows={5}
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder={'[Event "Minha partida"]\n\n1. e4 e5 2. Nf3 Nc6 *'}
        />
        <button
          className="section-gap"
          disabled={!pgn.trim()}
          onClick={() => void importPgn(pgn)}
        >
          Validar e importar
        </button>
        <p className="description">
          A revisão abre a posição final na arena. Use os controles de
          desfazer/refazer para percorrer a partida, com a IA pausada.
        </p>
      </section>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
    </>
  );
}
