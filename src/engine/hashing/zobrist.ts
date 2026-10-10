const MASK = (1n << 64n) - 1n;
let seed = 0x9e3779b97f4a7c15n;
function random64() {
  seed ^= seed << 13n;
  seed ^= seed >> 7n;
  seed ^= seed << 17n;
  return (seed &= MASK);
}
const PIECES = Array.from({ length: 12 }, () =>
  Array.from({ length: 64 }, random64),
);
const TURN = random64(),
  CASTLE = Array.from({ length: 4 }, random64),
  EP = Array.from({ length: 8 }, random64);
export function hashText(value: string) {
  let hash = 1469598103934665603n;
  for (const c of value)
    hash = ((hash ^ BigInt(c.charCodeAt(0))) * 1099511628211n) & MASK;
  return hash;
}
export function zobrist(fen: string): bigint {
  const [position, turn, castles, ep] = fen.split(" ");
  let hash = 0n,
    square = 0;
  for (const c of position) {
    if (c === "/") continue;
    if (/\d/.test(c)) {
      square += Number(c);
      continue;
    }
    const index = "PNBRQKpnbrqk".indexOf(c);
    if (index >= 0) hash ^= PIECES[index][square++];
  }
  if (turn === "b") hash ^= TURN;
  for (const [i, c] of [..."KQkq"].entries())
    if (castles.includes(c)) hash ^= CASTLE[i];
  if (ep !== "-") hash ^= EP[ep.charCodeAt(0) - 97];
  return hash;
}
