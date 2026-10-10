import type { Color, PieceSymbol } from "chess.js";
// Original vector artwork; released under this repository's MIT license.
const shapes: Record<PieceSymbol, string> = {
  p: "M17 43h30l-3-5H20z M21 37h22c-5-5-7-10-7-15H28c0 5-2 10-7 15z M32 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
  r: "M15 43h34l-3-5H18z M21 37h22l-2-16H23z M18 10v12h28V10h-6v6h-5v-6h-6v6h-5v-6z",
  n: "M15 43h34l-3-5H18z M21 37h22c-6-5-7-13-5-19l7 5 5-5-12-8-4-6-3 8c-13 5-13 16-10 25z M35 17l2 1",
  b: "M16 43h32l-3-5H19z M21 37h22c-6-5-8-11-7-14h-8c1 3-1 9-7 14z M32 6c-6 6-11 12-7 16 4 4 10 4 14 0 4-4-1-10-7-16z M30 12l6 7 M24 27h16",
  q: "M14 43h36l-4-5H18z M20 37h24c-6-5-8-10-8-14h-8c0 4-2 9-8 14z M24 23l-7-12 11 6 4-11 4 11 11-6-7 12z M17 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M32 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M47 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  k: "M14 43h36l-4-5H18z M20 37h24c-6-5-8-11-7-15H27c1 4-1 10-7 15z M22 16c-1-5 7-5 10-1 3-4 11-4 10 1l-5 7H27z M29 3h6v4h5v5h-5v4h-6v-4h-5V7h5z",
};
export function PieceSvg({
  type,
  color,
  fill,
  className,
}: {
  type: PieceSymbol;
  color: Color;
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="12 0 40 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={shapes[type]}
        fill={fill ?? (color === "w" ? "#e0ccb0" : "#30373a")}
        stroke={color === "w" ? "#3b3026" : "#e3d8c4"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M20 40h24"
        fill="none"
        stroke={color === "w" ? "#3b3026" : "#e3d8c4"}
        opacity=".65"
      />
    </svg>
  );
}
