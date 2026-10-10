import { Chess, type Move } from "chess.js";
import type { MoveInput } from "@/types/domain";
import { squareCoordinates, coordinatesSquare, ACTION_SPACE } from "./board";
const RAYS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];
const KNIGHTS = [
  [1, -2],
  [2, -1],
  [2, 1],
  [1, 2],
  [-1, 2],
  [-2, 1],
  [-2, -1],
  [-1, -2],
];
export function moveToAction(move: MoveInput, turn: "w" | "b"): number {
  const [x, y] = squareCoordinates(move.from, turn),
    [tx, ty] = squareCoordinates(move.to, turn),
    dx = tx - x,
    dy = ty - y;
  let plane = -1;
  if (move.promotion && move.promotion !== "q") {
    const piece = ["n", "b", "r"].indexOf(move.promotion);
    if (piece < 0 || dy !== -1 || Math.abs(dx) > 1)
      throw new Error("Invalid underpromotion");
    plane = 64 + piece * 3 + (dx + 1);
  } else {
    const knight = KNIGHTS.findIndex(([kx, ky]) => dx === kx && dy === ky);
    if (knight >= 0) plane = 56 + knight;
    else {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      const direction = RAYS.findIndex(
        ([rx, ry]) => dx === rx * distance && dy === ry * distance,
      );
      if (direction < 0 || distance < 1 || distance > 7)
        throw new Error("Invalid move geometry");
      plane = direction * 7 + distance - 1;
    }
  }
  return (y * 8 + x) * 73 + plane;
}
export function actionToMove(action: number, chess: Chess): MoveInput {
  if (!Number.isInteger(action) || action < 0 || action >= ACTION_SPACE)
    throw new Error("Invalid policy action");
  const fromIndex = Math.floor(action / 73),
    plane = action % 73,
    x = fromIndex % 8,
    y = Math.floor(fromIndex / 8),
    turn = chess.turn();
  let dx: number, dy: number, promotion: MoveInput["promotion"];
  if (plane < 56) {
    const dir = RAYS[Math.floor(plane / 7)],
      distance = (plane % 7) + 1;
    dx = dir[0] * distance;
    dy = dir[1] * distance;
  } else if (plane < 64) {
    [dx, dy] = KNIGHTS[plane - 56];
  } else {
    dx = ((plane - 64) % 3) - 1;
    dy = -1;
    promotion = (["n", "b", "r"] as const)[Math.floor((plane - 64) / 3)];
  }
  const from = coordinatesSquare(x, y, turn),
    to = coordinatesSquare(x + dx, y + dy, turn);
  if (
    !promotion &&
    chess.get(from)?.type === "p" &&
    (to[1] === "1" || to[1] === "8")
  )
    promotion = "q";
  return { from, to, ...(promotion ? { promotion } : {}) };
}
export function legalPolicy(
  policy: ArrayLike<number>,
  moves: Move[],
  turn: "w" | "b",
) {
  const values = moves.map((move) => {
    const action = moveToAction(move, turn),
      value = Number(policy[action]);
    return {
      move,
      action,
      probability: Number.isFinite(value) ? Math.max(0, value) : 0,
    };
  });
  const total = values.reduce((sum, p) => sum + p.probability, 0);
  return values.map((p) => ({
    ...p,
    probability:
      total > 1e-12 ? p.probability / total : 1 / Math.max(moves.length, 1),
  }));
}
