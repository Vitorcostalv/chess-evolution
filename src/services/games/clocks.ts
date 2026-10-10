import type { Chess, Color } from "chess.js";
export const CLOCK_PRESETS = [
  { id: "180+2", label: "3 + 2", seconds: 180, increment: 2 },
  { id: "300+3", label: "5 + 3", seconds: 300, increment: 3 },
  { id: "600+5", label: "10 + 5", seconds: 600, increment: 5 },
  { id: "300+0", label: "5 minutos", seconds: 300, increment: 0 },
  { id: "600+0", label: "10 minutos", seconds: 600, increment: 0 },
  { id: "1800+0", label: "30 minutos", seconds: 1800, increment: 0 },
  { id: "0+0", label: "Sem relógio", seconds: 0, increment: 0 },
] as const;
export function elapsedClock(seconds: number, since: number, now: number) {
  return Math.max(0, seconds - Math.max(0, now - since) / 1000);
}
export function timeoutResult(c: Chess, flagged: Color) {
  const opponent = flagged === "w" ? "b" : "w";
  const own = c
    .board()
    .flat()
    .filter((p) => p && p.color === opponent && p.type !== "k");
  const other = c
    .board()
    .flat()
    .filter((p) => p && p.color === flagged && p.type !== "k");
  const cannotMate =
    !own.length ||
    c.isInsufficientMaterial() ||
    (!other.length && own.length === 1 && ["b", "n"].includes(own[0]!.type));
  return cannotMate
    ? {
        result: "1/2-1/2" as const,
        reason: "Tempo esgotado; adversário sem material para mate",
      }
    : {
        result: flagged === "w" ? ("0-1" as const) : ("1-0" as const),
        reason: "Tempo esgotado",
      };
}
