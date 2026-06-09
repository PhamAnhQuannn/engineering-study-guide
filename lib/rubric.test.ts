import { describe, it, expect } from "vitest";
import { coverage, suggestRating, parseRubric, serializeRubric } from "./rubric";

describe("coverage", () => {
  it("returns the percentage of checked items", () => {
    expect(coverage(1, 4)).toBe(25);
  });

  it("is 0 when there are no items (no NaN)", () => {
    expect(coverage(0, 0)).toBe(0);
  });
});

describe("suggestRating", () => {
  it("suggests 'again' below 40%", () => {
    expect(suggestRating(25)).toBe("again");
  });

  it("suggests 'easy' above 80%", () => {
    expect(suggestRating(90)).toBe("easy");
  });

  it("treats the 40 and 80 boundaries as 'good'", () => {
    expect(suggestRating(40)).toBe("good");
    expect(suggestRating(80)).toBe("good");
  });
});

describe("parseRubric / serializeRubric", () => {
  it("parses a JSON array of strings", () => {
    expect(parseRubric('["defines it", "names tradeoffs"]')).toEqual([
      "defines it",
      "names tradeoffs",
    ]);
  });

  it("returns [] for malformed or empty rubric", () => {
    expect(parseRubric("not json")).toEqual([]);
    expect(parseRubric("[]")).toEqual([]);
    expect(parseRubric("")).toEqual([]);
  });

  it("round-trips through serialize", () => {
    const items = ["a", "b", "c"];
    expect(parseRubric(serializeRubric(items))).toEqual(items);
  });
});
