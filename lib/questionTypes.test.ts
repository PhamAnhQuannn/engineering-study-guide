import { describe, it, expect } from "vitest";
import { parseChoices } from "./questionTypes";

describe("parseChoices", () => {
  it("parses a JSON array of option strings", () => {
    expect(parseChoices('["A. one", "B. two"]')).toEqual(["A. one", "B. two"]);
  });

  it("returns null for null/empty input", () => {
    expect(parseChoices(null)).toBeNull();
    expect(parseChoices("")).toBeNull();
  });

  it("returns null for malformed JSON or non-array", () => {
    expect(parseChoices("not json")).toBeNull();
    expect(parseChoices('{"a":1}')).toBeNull();
    expect(parseChoices("[]")).toBeNull();
  });
});
