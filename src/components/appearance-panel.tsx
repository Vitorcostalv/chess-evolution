"use client";
import { usePreferences } from "@/stores/preferences";
import {
  THEMES,
  contrastRatio,
  type Appearance,
} from "@/services/games/appearance";
import { Board2D } from "./board-2d";
import { DEFAULT_POSITION } from "@/engine/chess/rules";
export function AppearancePanel() {
  const { value, update } = usePreferences(),
    a = value.appearance;
  const labels = {
    light: "Casas claras",
    dark: "Casas escuras",
    white: "Peças brancas",
    black: "Peças pretas",
    border: "Borda",
    selected: "Seleção",
    lastMove: "Última jogada",
    legal: "Destinos legais",
    check: "Xeque",
  };
  return (
    <section className="panel appearance-panel">
      <h2 className="section-title">Aparência do tabuleiro</h2>
      <div className="theme-presets">
        {Object.entries(THEMES).map(([id, theme], i) => (
          <button
            key={id}
            aria-pressed={a.preset === id}
            onClick={() => void update({ appearance: { ...theme } })}
          >
            <span
              style={{
                background: `linear-gradient(135deg, ${theme.light} 50%, ${theme.dark} 50%)`,
              }}
            />
            {["Clássico", "Mineral", "Bronze", "Alto contraste"][i]}
          </button>
        ))}
      </div>
      <div className="appearance-preview">
        <Board2D
          fen={DEFAULT_POSITION}
          selected="e2"
          legal={["e3", "e4"]}
          last={["g8", "f6"]}
          appearance={a}
          onSelect={() => {}}
        />
      </div>
      <p className="description">
        Prévia 2D. Cores, destaques e acabamento também são aplicados no 3D; os
        contornos dos SVGs preservam a leitura das peças.
      </p>
      <div className="color-controls">
        {Object.entries(labels).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="color"
              aria-label={label}
              value={a[key as keyof typeof labels]}
              onChange={(event) =>
                void update({
                  appearance: {
                    ...a,
                    preset: "custom",
                    [key]: event.target.value,
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      {Math.min(
        contrastRatio(a.white, a.black),
        contrastRatio(a.light, a.dark),
      ) < 2 && (
        <p role="status" className="notice">
          Cores próximas dificultam a leitura. Use Alto contraste ou afaste os
          tons; contornos e formas continuam visíveis.
        </p>
      )}
      <label>
        Acabamento 3D
        <select
          value={a.finish}
          onChange={(event) =>
            void update({
              appearance: {
                ...a,
                finish: event.target.value as Appearance["finish"],
              },
            })
          }
        >
          <option value="matte">Fosco</option>
          <option value="polished">Polido</option>
          <option value="metallic">Metálico</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          Animações
          <select
            aria-label="Animações"
            value={value.animation}
            onChange={(event) =>
              void update({
                animation: event.target.value as typeof value.animation,
              })
            }
          >
            <option value="normal">Normais</option>
            <option value="fast">Rápidas</option>
            <option value="off">Desativadas</option>
          </select>
        </label>
        <label>
          Duração normal (ms)
          <input
            type="number"
            min={180}
            max={300}
            step={20}
            value={value.animationDuration}
            onChange={(event) =>
              void update({ animationDuration: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <p className="description">
        A preferência de movimento reduzido do dispositivo tem prioridade. O
        modo acelerado de IA × IA dispensa animações.
      </p>
      <button
        onClick={() =>
          void update({
            appearance: { ...THEMES.classic },
            animation: "normal",
            animationDuration: 240,
          })
        }
      >
        Restaurar aparência padrão
      </button>
    </section>
  );
}
