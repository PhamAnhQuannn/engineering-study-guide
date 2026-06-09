import { describe, it, expect } from "vitest";
import { parseCategory } from "./docsParse";

const practice = (body: string) => `# Topic — Practice Questions\n\n${body}\n`;

describe("parseCategory — checklist extraction", () => {
  it("captures the **Checklist** bullets for a question", () => {
    const text = practice(
      `### Q1. What is a hash collision?
**Answer:** Two keys map to the same bucket.
**Checklist**
- [ ] Defines collision
- [ ] Names a resolution strategy`
    );
    const [q] = parseCategory("02-practice-questions", text);
    expect(q.checklist).toEqual([
      "Defines collision",
      "Names a resolution strategy",
    ]);
  });

  it("returns an empty checklist when none is authored", () => {
    const text = practice(`### Q1. What is X?\n**Answer:** X is a thing.`);
    const [q] = parseCategory("02-practice-questions", text);
    expect(q.checklist).toEqual([]);
    expect(q.referenceAnswer).toContain("X is a thing");
  });

  it("keeps the checklist out of the model answer", () => {
    const text = practice(
      `### Q1. What is X?
**Answer:** X is a thing.
**Checklist**
- [ ] Defines collision`
    );
    const [q] = parseCategory("02-practice-questions", text);
    expect(q.referenceAnswer).not.toContain("Checklist");
    expect(q.referenceAnswer).not.toContain("Defines collision");
  });

  it("terminates a question's checklist at the next question heading", () => {
    const text = practice(
      `### Q1. First?
**Answer:** one.
**Checklist**
- [ ] a

### Q2. Second?
**Answer:** two.`
    );
    const qs = parseCategory("02-practice-questions", text);
    expect(qs).toHaveLength(2);
    expect(qs[0].checklist).toEqual(["a"]);
    expect(qs[1].checklist).toEqual([]);
    expect(qs[1].referenceAnswer).toContain("two");
  });
});
