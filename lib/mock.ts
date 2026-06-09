import type { QuestionTypeKey } from "./questionTypes";

// Mock interview = a session layer over the bank (issue 005, docs/PLAN.md §C).
// Pure module: templates, slot expansion, scorecard aggregation. No I/O.

export interface MockTemplate {
  id: string;
  label: string;
  blurb: string;
  /** Ordered question types to ask. */
  slots: QuestionTypeKey[];
  /** Soft per-question time budget (seconds). */
  perQuestionSec: number;
}

export const MOCK_TEMPLATES: MockTemplate[] = [
  {
    id: "quick5",
    label: "Quick 5",
    blurb: "5 mixed questions, ~15 min warmup",
    slots: ["KNOWLEDGE", "QUIZ", "CODING", "DECISION", "BEHAVIORAL"],
    perQuestionSec: 180,
  },
  {
    id: "senior-loop",
    label: "Senior Backend Loop",
    blurb: "Realistic ~60 min: knowledge → coding → design → behavioral",
    slots: ["KNOWLEDGE", "KNOWLEDGE", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL"],
    perQuestionSec: 720,
  },
];

export function templateById(id: string): MockTemplate | undefined {
  return MOCK_TEMPLATES.find((t) => t.id === id);
}

/** Custom builder: expand chosen types into `count` ordered slots (round-robin). */
export function slotsForConfig(types: QuestionTypeKey[], count: number): QuestionTypeKey[] {
  if (types.length === 0 || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => types[i % types.length]);
}

// ---- Scorecard ----

export interface MockItemResult {
  type: QuestionTypeKey;
  topicSlug: string;
  topicName: string;
  score: number; // 0-100
  timeTakenSec: number;
  overTime: boolean;
  skipped: boolean;
}

export interface Bucket {
  key: string;
  label: string;
  avg: number;
  n: number;
}

export interface Scorecard {
  overall: number;
  graded: number;
  total: number;
  skipped: number;
  overTime: number;
  byType: Bucket[];
  byTopic: Bucket[];
  weak: Bucket[]; // buckets with avg < 60 (by topic)
}

function avg(xs: number[]): number {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
}

function bucket(
  items: MockItemResult[],
  keyOf: (i: MockItemResult) => string,
  labelOf: (i: MockItemResult) => string
): Bucket[] {
  const groups = new Map<string, { label: string; scores: number[] }>();
  for (const i of items) {
    const k = keyOf(i);
    const g = groups.get(k) ?? { label: labelOf(i), scores: [] };
    g.scores.push(i.score);
    groups.set(k, g);
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    avg: avg(g.scores),
    n: g.scores.length,
  }));
}

export function scorecard(items: MockItemResult[]): Scorecard {
  const graded = items.filter((i) => !i.skipped);
  const byType = bucket(graded, (i) => i.type, (i) => i.type).sort((a, b) => a.avg - b.avg);
  const byTopic = bucket(graded, (i) => i.topicSlug, (i) => i.topicName).sort((a, b) => a.avg - b.avg);
  return {
    overall: avg(graded.map((i) => i.score)),
    graded: graded.length,
    total: items.length,
    skipped: items.filter((i) => i.skipped).length,
    overTime: items.filter((i) => i.overTime).length,
    byType,
    byTopic,
    weak: byTopic.filter((b) => b.avg < 60),
  };
}
