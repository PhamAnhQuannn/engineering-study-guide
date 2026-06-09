import type { QuestionTypeKey } from "./questionTypes";

// Deterministic parser: turns a category README's markdown into question records.
// Formats are regular (verified): each category delimits questions by a heading
// prefix and the model answer by a known bold marker.

export interface ParsedQuestion {
  type: QuestionTypeKey;
  prompt: string;
  choices: string[] | null;
  referenceAnswer: string;
  isMcq: boolean;
  /** Senior-answer rubric: key points a strong answer must hit. [] if none authored. */
  checklist: string[];
}

export type CategoryKey =
  | "practice-questions"
  | "coding-problems"
  | "design-questions"
  | "estimation-questions"
  | "decision-questions"
  | "real-situations"
  | "behavioral-questions";

interface Cfg {
  headerRe: RegExp; // matches a question-heading line
  stripRe: RegExp; // strips the heading prefix, leaving the title
  answerRe: RegExp; // marks where the model answer begins
  mode: "heading" | "untilMarker"; // include pre-answer body in the prompt?
  type: QuestionTypeKey | "PRACTICE";
}

// Heading levels and number tokens vary across authoring agents, so match 2-3
// hashes and the word/letter variants. When the answer marker is absent the
// parser falls back to prompt=heading, answer=body (still usable).
const CFG: Record<CategoryKey, Cfg> = {
  "practice-questions": {
    headerRe: /^#{2,3}\s+Q\d+/i,
    stripRe: /^#{2,3}\s+Q\d+\s*(\(mcq\))?\.?\s*/i,
    answerRe: /^\*\*answer/i,
    mode: "heading",
    type: "PRACTICE",
  },
  "coding-problems": {
    headerRe: /^#{2,3}\s+(?:problem\s*\d+|p\d+)/i,
    stripRe: /^#{2,3}\s+(?:problem\s*\d+|p\d+)\s*[—\-.:]*\s*/i,
    answerRe: /^\*\*approach/i,
    mode: "untilMarker",
    type: "CODING",
  },
  "design-questions": {
    headerRe: /^#{2,3}\s+D\d+/i,
    stripRe: /^#{2,3}\s+D\d+\.?\s*/i,
    answerRe: /^\*\*requirements/i,
    mode: "heading",
    type: "SYSTEM_DESIGN",
  },
  "estimation-questions": {
    headerRe: /^#{2,3}\s+E\d+/i,
    stripRe: /^#{2,3}\s+E\d+\.?\s*/i,
    answerRe: /^\*\*assumptions/i,
    mode: "heading",
    type: "ESTIMATION",
  },
  "decision-questions": {
    headerRe: /^#{2,3}\s+D(?:C)?\d+/i,
    stripRe: /^#{2,3}\s+D(?:C)?\d+\.?\s*/i,
    answerRe: /^\*\*recommendation/i,
    mode: "untilMarker",
    type: "DECISION",
  },
  "real-situations": {
    headerRe: /^#{2,3}\s+(?:S\d+|situation\s*\d+)/i,
    stripRe: /^#{2,3}\s+(?:S\d+|situation\s*\d+)\s*[—\-.:]*\s*/i,
    answerRe: /^\*\*mitigate/i,
    mode: "untilMarker",
    type: "SCENARIO",
  },
  "behavioral-questions": {
    headerRe: /^#{2,3}\s+B\d+/i,
    stripRe: /^#{2,3}\s+B\d+\.?\s*/i,
    answerRe: /^\*\*what good looks like/i,
    mode: "heading",
    type: "BEHAVIORAL",
  },
};

/** "02-practice-questions" -> "practice-questions" (null for knowledge/unknown). */
export function categoryKeyFromFolder(folder: string): CategoryKey | null {
  const k = folder.replace(/^\d+-/, "");
  return k in CFG ? (k as CategoryKey) : null;
}

const OPTION_RE = /^[A-D][.)]\s+/;

// A question's answer block may end with a checklist: a `**Checklist**` marker
// line followed by `- [ ]` / `- [x]` bullets. Split it off so it doesn't leak
// into the model answer.
const CHECKLIST_RE = /^\*\*checklist/i;
const CHECK_ITEM_RE = /^\s*-\s*\[[ xX]\]\s*/;

function splitChecklist(answerLines: string[]): { answer: string[]; checklist: string[] } {
  const cIdx = answerLines.findIndex((l) => CHECKLIST_RE.test(l));
  if (cIdx < 0) return { answer: answerLines, checklist: [] };
  const checklist = answerLines
    .slice(cIdx + 1)
    .filter((l) => CHECK_ITEM_RE.test(l))
    .map((l) => l.replace(CHECK_ITEM_RE, "").trim())
    .filter(Boolean);
  return { answer: answerLines.slice(0, cIdx), checklist };
}

export function parseCategory(folder: string, text: string): ParsedQuestion[] {
  const key = categoryKeyFromFolder(folder);
  if (!key) return [];
  const cfg = CFG[key];

  const lines = text.split(/\r?\n/);
  const headerIdx: number[] = [];
  lines.forEach((l, i) => {
    if (cfg.headerRe.test(l)) headerIdx.push(i);
  });

  const out: ParsedQuestion[] = [];
  for (let h = 0; h < headerIdx.length; h++) {
    const start = headerIdx[h];
    const end = h + 1 < headerIdx.length ? headerIdx[h + 1] : lines.length;
    const segment = lines.slice(start, end);
    const headingText = segment[0].replace(cfg.stripRe, "").trim();
    const body = segment.slice(1);

    const mIdx = body.findIndex((l) => cfg.answerRe.test(l));
    const before = mIdx >= 0 ? body.slice(0, mIdx) : body;
    const answerLines = mIdx >= 0 ? body.slice(mIdx) : body;

    const { answer: ansLines, checklist } = splitChecklist(answerLines);

    if (cfg.type === "PRACTICE") {
      const opts = before
        .map((l) => l.trim())
        .filter((l) => OPTION_RE.test(l));
      const isMcq = opts.length >= 2;
      const referenceAnswer = ansLines.join("\n").trim();
      if (!headingText || !referenceAnswer) continue;
      out.push({
        type: isMcq ? "QUIZ" : "KNOWLEDGE",
        prompt: headingText,
        choices: isMcq ? opts : null,
        referenceAnswer,
        isMcq,
        checklist,
      });
    } else {
      let prompt = headingText;
      if (cfg.mode === "untilMarker" && mIdx >= 0) {
        const extra = before.join("\n").trim();
        if (extra) prompt = `${headingText}\n\n${extra}`;
      }
      const referenceAnswer = ansLines.join("\n").trim();
      if (!prompt || !referenceAnswer) continue;
      out.push({
        type: cfg.type as QuestionTypeKey,
        prompt,
        choices: null,
        referenceAnswer,
        isMcq: false,
        checklist,
      });
    }
  }
  return out;
}
