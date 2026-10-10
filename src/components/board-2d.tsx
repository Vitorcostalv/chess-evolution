"use client";
import { Chess, type Square } from "chess.js";
import { memo, type CSSProperties } from "react";
import { PieceSvg } from "./piece-svg";
import { THEMES, type Appearance } from "@/services/games/appearance";
import { pieceInstances } from "@/services/games/pieces";
import type { VisualPiece } from "@/services/games/presentation";
export const Board2D = memo(function Board2D({
  fen,
  initialFen,
  pgn = "",
  selected,
  legal,
  onSelect,
  flipped = false,
  appearance = THEMES.classic,
  pieces,
  duration = 0,
  last = [],
  check,
}: {
  fen: string;
  initialFen?: string;
  pgn?: string;
  selected: Square | null;
  legal: Square[];
  onSelect: (square: Square) => void;
  flipped?: boolean;
  appearance?: Appearance;
  pieces?: VisualPiece[];
  duration?: number;
  last?: Square[];
  check?: Square;
}) {
  const c = new Chess(fen),
    files = flipped ? "hgfedcba" : "abcdefgh",
    ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const visual: VisualPiece[] =
    pieces ?? pieceInstances(initialFen ?? fen, pgn);
  const colors = Object.fromEntries(
    Object.entries(appearance).map(([key, value]) => [`--chess-${key}`, value]),
  ) as CSSProperties;
  return (
    <div
      className="board-2d"
      style={colors}
      role="group"
      aria-label="Tabuleiro de xadrez acessivel"
    >
      {ranks.flatMap((rank, y) =>
        [...files].map((file, x) => {
          const square = `${file}${rank}` as Square,
            p = c.get(square);
          return (
            <button
              key={square}
              onClick={() => onSelect(square)}
              className={`square ${(x + y) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${legal.includes(square) ? "legal" : ""} ${last.includes(square) ? "last-move" : ""} ${check === square ? "in-check" : ""}`}
              aria-label={`${square}${p ? ` ${p.color === "w" ? "branca" : "preta"} ${p.type}` : " vazia"}`}
              title={
                check === square
                  ? "Rei em xeque"
                  : last.includes(square)
                    ? "Ultima jogada"
                    : undefined
              }
            >
              {x === 0 && <small className="rank">{rank}</small>}
              {y === 7 && <small className="file">{file}</small>}
            </button>
          );
        }),
      )}
      <div className="piece-layer" aria-hidden="true">
        {visual.map((p) => {
          const x = files.indexOf(p.square[0]),
            y = ranks.indexOf(Number(p.square[1]));
          return (
            <span
              key={p.id}
              className="svg-piece"
              data-piece-id={p.id}
              data-square={p.square}
              data-exiting={p.exiting || undefined}
              style={{
                transform: `translate(${x * 100}%, ${y * 100}%) scale(${p.exiting ? 0.7 : 1})`,
                opacity: p.exiting ? 0 : 1,
                transitionDuration: `${duration}ms, ${duration / 4}ms`,
                transitionDelay: `0ms, ${p.exiting ? duration * 0.75 : 0}ms`,
              }}
            >
              <PieceSvg
                type={p.type}
                color={p.color}
                fill={p.color === "w" ? appearance.white : appearance.black}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
});
