// Rubric = JSON list of checklist points a strong answer must hit.
// Pure helpers: coverage math + coverage→rating suggestion + (de)serialize.

import type { Rating } from "./spacedRepetition";

export function coverage(checked: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((checked / total) * 100);
}

// Coverage % → suggested SR rating. Thresholds: <40 again, 40–80 good, >80 easy.
export function suggestRating(coveragePct: number): Rating {
  if (coveragePct < 40) return "again";
  if (coveragePct > 80) return "easy";
  return "good";
}

// Stored as a JSON string in Question.rubric. Parse defensively (malformed → []).
export function parseRubric(json: string): string[] {
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

export function serializeRubric(items: string[]): string {
  return JSON.stringify(items);
}
