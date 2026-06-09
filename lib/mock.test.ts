import { describe, it, expect } from "vitest";
import {
  MOCK_TEMPLATES,
  templateById,
  slotsForConfig,
  scorecard,
  type MockItemResult,
} from "./mock";

describe("templates", () => {
  it("Senior Backend Loop is KNOWLEDGE×2 → CODING → SYSTEM_DESIGN → BEHAVIORAL", () => {
    const t = templateById("senior-loop")!;
    expect(t.slots).toEqual(["KNOWLEDGE", "KNOWLEDGE", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL"]);
  });
  it("Quick 5 has 5 slots", () => {
    expect(templateById("quick5")!.slots).toHaveLength(5);
  });
  it("templateById returns undefined for unknown id", () => {
    expect(templateById("nope")).toBeUndefined();
    expect(MOCK_TEMPLATES.length).toBeGreaterThanOrEqual(2);
  });
});

describe("slotsForConfig", () => {
  it("round-robins chosen types up to count", () => {
    expect(slotsForConfig(["CODING", "KNOWLEDGE"], 5)).toEqual([
      "CODING",
      "KNOWLEDGE",
      "CODING",
      "KNOWLEDGE",
      "CODING",
    ]);
  });
  it("returns [] for empty types or non-positive count", () => {
    expect(slotsForConfig([], 5)).toEqual([]);
    expect(slotsForConfig(["CODING"], 0)).toEqual([]);
  });
});

describe("scorecard", () => {
  const items: MockItemResult[] = [
    { type: "KNOWLEDGE", topicSlug: "caching", topicName: "Caching", score: 90, timeTakenSec: 60, overTime: false, skipped: false },
    { type: "KNOWLEDGE", topicSlug: "caching", topicName: "Caching", score: 70, timeTakenSec: 200, overTime: true, skipped: false },
    { type: "CODING", topicSlug: "algorithms", topicName: "Algorithms", score: 40, timeTakenSec: 300, overTime: false, skipped: false },
    { type: "BEHAVIORAL", topicSlug: "mentorship", topicName: "Mentorship", score: 0, timeTakenSec: 0, overTime: false, skipped: true },
  ];

  it("averages only graded (non-skipped) items", () => {
    const s = scorecard(items);
    expect(s.overall).toBe(67); // (90+70+40)/3
    expect(s.graded).toBe(3);
    expect(s.total).toBe(4);
    expect(s.skipped).toBe(1);
  });
  it("counts over-time items", () => {
    expect(scorecard(items).overTime).toBe(1);
  });
  it("aggregates by type and topic", () => {
    const s = scorecard(items);
    const caching = s.byTopic.find((b) => b.key === "caching")!;
    expect(caching.avg).toBe(80); // (90+70)/2
    expect(caching.n).toBe(2);
    const knowledge = s.byType.find((b) => b.key === "KNOWLEDGE")!;
    expect(knowledge.avg).toBe(80);
  });
  it("flags weak topics (avg < 60)", () => {
    const s = scorecard(items);
    expect(s.weak.map((b) => b.key)).toContain("algorithms");
    expect(s.weak.map((b) => b.key)).not.toContain("caching");
  });
});
