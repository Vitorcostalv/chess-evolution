"use client";
import { useState } from "react";
import { usePreferences } from "@/stores/preferences";
import { storage } from "@/services/storage/database";
import { RemoteSettings } from "./remote-settings";
import { AppearancePanel } from "./appearance-panel";
export function Settings() {
  const { value, update, error } = usePreferences(),
    [message, setMessage] = useState("");
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">YOUR PLAYING ENVIRONMENT</div>
          <h1>
            Feito para <em>o seu ritmo.</em>
          </h1>
          <p>Ajuste a experiência ao seu dispositivo e à sua forma de jogar.</p>
        </div>
      </section>
      <div className="content-grid">
        <div className="stack">
          <AppearancePanel />
          <section className="panel">
            <h2 className="section-title">Tabuleiro & experiência</h2>
            <div className="settings-row">
              <div>
                <strong>Perfil gráfico</strong>
                <p>Qualidade de sombras, geometrias e resolução.</p>
              </div>
              <select
                aria-label="Perfil gráfico"
                value={value.graphics}
                onChange={(e) =>
                  void update({
                    graphics: e.target.value as typeof value.graphics,
                  })
                }
              >
                <option value="low">Baixo</option>
                <option value="medium">Médio</option>
                <option value="high">Alto</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <strong>Tabuleiro</strong>
                <p>O modo 2D funciona sem WebGL e com teclado.</p>
              </div>
              <select
                aria-label="Modo do tabuleiro"
                value={value.board}
                onChange={(e) =>
                  void update({ board: e.target.value as "2d" | "3d" })
                }
              >
                <option value="3d">3D</option>
                <option value="2d">2D acessível</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <strong>Câmera</strong>
                <p>Vista isométrica ou de cima.</p>
              </div>
              <select
                aria-label="Câmera"
                value={value.camera}
                onChange={(e) =>
                  void update({ camera: e.target.value as typeof value.camera })
                }
              >
                <option value="isometric">Isométrica</option>
                <option value="top">Superior</option>
              </select>
            </div>
            {[
              [
                "hints",
                "Indicar jogadas legais",
                "Destaque os destinos da peça selecionada.",
              ],
              [
                "sound",
                "Som de movimentos",
                "Um toque discreto a cada jogada.",
              ],
              [
                "autoPause",
                "Pausar treino em segundo plano",
                "Solicita pausa quando esta aba fica oculta.",
              ],
            ].map(([key, title, description]) => (
              <div key={key} className="settings-row">
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <input
                  type="checkbox"
                  aria-label={title}
                  checked={Boolean(value[key as keyof typeof value])}
                  onChange={(e) => void update({ [key]: e.target.checked })}
                />
              </div>
            ))}
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <h2 className="section-title">Dados sob seu controle.</h2>
            <p className="description">
              Partidas, pesos e experimentos são salvos no IndexedDB deste
              navegador. Nenhum treinamento usa serviço pago ou envia seus dados
              para uma API externa.
            </p>
            <div className="settings-row">
              <div>
                <strong>Consentimento para aprendizado pessoal</strong>
                <p>
                  Ao salvar uma partida concluída, inclui as suas jogadas e o
                  resultado no replay local. Desativado por padrão.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Consentimento para aprendizado pessoal"
                checked={value.personalLearning}
                onChange={(e) =>
                  void update({ personalLearning: e.target.checked })
                }
              />
            </div>
            <button
              className="section-gap"
              onClick={() =>
                void storage
                  .clearReplay()
                  .then(() =>
                    setMessage(
                      "Replay buffer limpo. Modelos e partidas foram preservados.",
                    ),
                  )
                  .catch((err) => setMessage(String(err)))
              }
            >
              Limpar replay buffer
            </button>
            <p className="description">
              Exporte seus modelos e PGNs antes de limpar os dados do site ou
              mudar de navegador.
            </p>
          </section>
          <RemoteSettings />
        </div>
      </div>
      {(error || message) && (
        <div className="notice" role="status">
          {error ?? message}
        </div>
      )}
    </>
  );
}
