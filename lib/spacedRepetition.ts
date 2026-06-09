// Self-study spaced repetition: a 3-button rating (again/good/easy) drives the
// next review interval, SM-2-lite style.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type Rating = "again" | "good" | "easy";

export function isRating(v: unknown): v is Rating {
  return v === "again" || v === "good" || v === "easy";
}

// Score recorded per attempt (feeds the running average / weak-area surfacing).
export function scoreForRating(rating: Rating): number {
  switch (rating) {
    case "again":
      return 20;
    case "good":
      return 70;
    case "easy":
      return 95;
  }
}

// Next-review interval per rating (named so tuning lives in one place).
export const SR_INTERVAL_MS: Record<Rating, number> = {
  again: 8 * HOUR_MS,
  good: 3 * DAY_MS,
  easy: 14 * DAY_MS,
};

export function nextDueForRating(rating: Rating, now: Date = new Date()): Date {
  return new Date(now.getTime() + SR_INTERVAL_MS[rating]);
}

// Running average across attempts.
export function updateAvg(prevAvg: number, prevCount: number, newScore: number): number {
  const total = prevAvg * prevCount + newScore;
  return Math.round(total / (prevCount + 1));
}
