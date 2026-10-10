import type { EvaluationRecord } from "@/types/domain";
export function wilsonLower(points: number, games: number, z = 1.96) {
  if (!games) return 0;
  return (
    (points +
      (z * z) / (2 * games) -
      z *
        Math.sqrt(
          (points * (1 - points)) / games + (z * z) / (4 * games * games),
        )) /
    (1 + (z * z) / games)
  );
}
export function evaluatePromotion(
  wins: number,
  draws: number,
  losses: number,
  minimum = 8,
  threshold = 0.6,
) {
  const games = wins + draws + losses,
    points = games ? (wins + draws * 0.5) / games : 0,
    lowerBound = wilsonLower(points, games);
  const eloDifference =
    points > 0 && points < 1 ? 400 * Math.log10(points / (1 - points)) : null;
  return {
    games,
    wins,
    draws,
    losses,
    points,
    lowerBound,
    eloDifference,
    promoted: games >= minimum && points >= threshold && lowerBound > 0.5,
  } satisfies Omit<EvaluationRecord, "id" | "opponent" | "at">;
}
