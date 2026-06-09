import { describe, it, expect } from "vitest";
import {
  isRating,
  scoreForRating,
  nextDueForRating,
  updateAvg,
  SR_INTERVAL_MS,
} from "./spacedRepetition";

describe("isRating", () => {
  it("accepts the three valid ratings, rejects others", () => {
    expect(isRating("again")).toBe(true);
    expect(isRating("good")).toBe(true);
    expect(isRating("easy")).toBe(true);
    expect(isRating("meh")).toBe(false);
    expect(isRating(3)).toBe(false);
  });
});

describe("scoreForRating", () => {
  it("maps ratings to ascending scores", () => {
    expect(scoreForRating("again")).toBe(20);
    expect(scoreForRating("good")).toBe(70);
    expect(scoreForRating("easy")).toBe(95);
  });
});

describe("nextDueForRating", () => {
  const now = new Date("2026-06-08T00:00:00.000Z");
  it("schedules each rating its configured interval ahead", () => {
    expect(nextDueForRating("again", now).getTime()).toBe(now.getTime() + SR_INTERVAL_MS.again);
    expect(nextDueForRating("good", now).getTime()).toBe(now.getTime() + SR_INTERVAL_MS.good);
    expect(nextDueForRating("easy", now).getTime()).toBe(now.getTime() + SR_INTERVAL_MS.easy);
  });
  it("orders intervals again < good < easy", () => {
    expect(SR_INTERVAL_MS.again).toBeLessThan(SR_INTERVAL_MS.good);
    expect(SR_INTERVAL_MS.good).toBeLessThan(SR_INTERVAL_MS.easy);
  });
});

describe("updateAvg", () => {
  it("computes a running average", () => {
    expect(updateAvg(0, 0, 80)).toBe(80);
    expect(updateAvg(80, 1, 60)).toBe(70);
    expect(updateAvg(70, 2, 100)).toBe(80);
  });
});
