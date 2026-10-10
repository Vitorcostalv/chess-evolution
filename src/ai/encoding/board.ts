import { Chess, type Square } from "chess.js";
export const CHANNELS = 20,
  ACTION_SPACE = 4672;
export function squareCoordinates(
  square: Square,
  turn: "w" | "b",
): [number, number] {
  let x = square.charCodeAt(0) - 97,
    y = 8 - Number(square[1]);
  if (turn === "b") {
    x = 7 - x;
    y = 7 - y;
  }
  return [x, y];
}
export function coordinatesSquare(
  x: number,
  y: number,
  turn: "w" | "b",
): Square {
  if (turn === "b") {
    x = 7 - x;
    y = 7 - y;
  }
  if (x < 0 || x > 7 || y < 0 || y > 7) throw new Error("Action outside board");
  return `${String.fromCharCode(97 + x)}${8 - y}` as Square;
}
export function encodeBoard(chess: Chess, repetition = 1): Float32Array {
  const data = new Float32Array(8 * 8 * CHANNELS),
    turn = chess.turn(),
    fen = chess.fen().split(" ");
  const own = turn === "w" ? ["K", "Q"] : ["k", "q"],
    other = turn === "w" ? ["k", "q"] : ["K", "Q"];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const offset = (y * 8 + x) * CHANNELS;
      data[offset + 12] = turn === "w" ? 1 : 0;
      [...own, ...other].forEach((right, i) => {
        data[offset + 13 + i] = fen[2].includes(right) ? 1 : 0;
      });
      data[offset + 18] = Math.min(Number(fen[4]) / 150, 1);
      data[offset + 19] = Math.min(Math.max(repetition - 1, 0) / 4, 1);
    }
  for (const row of chess.board())
    for (const p of row)
      if (p) {
        const [x, y] = squareCoordinates(p.square, turn),
          channel = "pnbrqk".indexOf(p.type) + (p.color === turn ? 0 : 6);
        data[(y * 8 + x) * CHANNELS + channel] = 1;
      }
  if (fen[3] !== "-") {
    const [x, y] = squareCoordinates(fen[3] as Square, turn);
    data[(y * 8 + x) * CHANNELS + 17] = 1;
  }
  return data;
}
