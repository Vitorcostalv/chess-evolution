"use client";
import { Chess, type Square } from "chess.js";
const symbols = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
export function Board2D({
  fen,
  selected,
  legal,
  onSelect,
  flipped = false,
}: {
  fen: string;
  selected: Square | null;
  legal: Square[];
  onSelect: (square: Square) => void;
  flipped?: boolean;
}) {
  const c = new Chess(fen),
    files = flipped ? "hgfedcba" : "abcdefgh",
    ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  return (
    <div
      className="board-2d"
      role="group"
      aria-label="Tabuleiro de xadrez acessível"
    >
      {ranks.flatMap((rank, y) =>
        [...files].map((file, x) => {
          const square = `${file}${rank}` as Square,
            p = c.get(square);
          return (
            <button
              key={square}
              onClick={() => onSelect(square)}
              className={`square ${(x + y) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${legal.includes(square) ? "legal" : ""}`}
              aria-label={`${square}${p ? ` ${p.color === "w" ? "branca" : "preta"} ${p.type}` : " vazia"}`}
            >
              <span
                className={p?.color === "w" ? "white-piece" : "black-piece"}
              >
                {p ? symbols[p.color][p.type] : ""}
              </span>
              {x === 0 && <small className="rank">{rank}</small>}
              {y === 7 && <small className="file">{file}</small>}
            </button>
          );
        }),
      )}
    </div>
  );
}
