// Registry of question types. Drives both LLM generation/grading and the UI answer widget.

export type QuestionTypeKey =
  | "KNOWLEDGE"
  | "EXPLAIN"
  | "CODING"
  | "SYSTEM_DESIGN"
  | "DECISION"
  | "SCENARIO"
  | "BEHAVIORAL"
  | "DEBUG"
  | "ESTIMATION"
  | "QUIZ";

export type AnswerMode = "text" | "code" | "mcq";

export interface QuestionTypeDef {
  key: QuestionTypeKey;
  label: string;
  blurb: string;
  answerMode: AnswerMode;
  isMcq: boolean;
  /** Tells the generator how to craft this kind of question. */
  genGuidance: string;
  /** Tells the grader what a strong answer looks like. */
  gradeGuidance: string;
}

export const QUESTION_TYPES: Record<QuestionTypeKey, QuestionTypeDef> = {
  KNOWLEDGE: {
    key: "KNOWLEDGE",
    label: "Knowledge recall",
    blurb: "Quick factual recall — definitions and core concepts.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Ask one focused factual/definitional question that a senior backend engineer must know cold. Keep it answerable in 2-4 sentences.",
    gradeGuidance:
      "Reward factual accuracy and completeness of the core definition. Penalize vague or wrong statements.",
  },
  EXPLAIN: {
    key: "EXPLAIN",
    label: "Explain a concept",
    blurb: "Explain a concept clearly, as if teaching a junior.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Ask the candidate to explain a concept to a junior, probing depth of understanding (the 'why', tradeoffs, when it applies).",
    gradeGuidance:
      "Reward clarity, correct mental model, mention of tradeoffs and when-to-use. Penalize hand-waving and buzzwords without substance.",
  },
  CODING: {
    key: "CODING",
    label: "Coding / DSA",
    blurb: "Solve an algorithm/coding problem and state complexity.",
    answerMode: "code",
    isMcq: false,
    genGuidance:
      "Pose a self-contained coding/DSA problem with a clear input/output spec and constraints. Ask the candidate to also state time/space complexity. Keep it solvable in ~20 min.",
    gradeGuidance:
      "Reward correctness, edge-case handling, optimal-or-justified complexity, and clean code. Require the stated time/space complexity to be correct.",
  },
  SYSTEM_DESIGN: {
    key: "SYSTEM_DESIGN",
    label: "System design",
    blurb: "Open-ended design of a backend system or component.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Pose an open-ended backend system-design prompt. State rough scale/requirements. Expect discussion of API, data model, scaling, bottlenecks, tradeoffs.",
    gradeGuidance:
      "Reward a structured approach: requirements/scale, high-level design, data model, scaling & bottlenecks, explicit tradeoffs and failure modes. Penalize jumping to tech names without reasoning.",
  },
  DECISION: {
    key: "DECISION",
    label: "Decision / tradeoff",
    blurb: "Choose between options and justify the tradeoff.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Present a realistic backend decision with 2-3 viable options (e.g. SQL vs NoSQL, sync vs async, monolith vs service). Ask the candidate to choose and justify under stated constraints.",
    gradeGuidance:
      "Reward a clear decision tied to the constraints, honest tradeoff analysis of alternatives, and awareness of what would change the answer. Penalize one-sided answers ignoring downsides.",
  },
  SCENARIO: {
    key: "SCENARIO",
    label: "Real situation",
    blurb: "Handle a realistic on-the-job situation.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Describe a concrete real-world backend situation (prod incident, latency spike, data inconsistency, urgent migration). Ask what the candidate does, step by step.",
    gradeGuidance:
      "Reward a calm, methodical approach: mitigate first, diagnose with data, communicate, then fix root cause and add prevention. Penalize reckless or unstructured reactions.",
  },
  BEHAVIORAL: {
    key: "BEHAVIORAL",
    label: "Behavioral (STAR)",
    blurb: "Tell a structured story from your experience.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Ask a senior-level behavioral question (leadership, conflict, failure, influence, mentoring). Encourage a STAR-structured answer.",
    gradeGuidance:
      "Reward STAR structure (Situation, Task, Action, Result), senior signals (ownership, influence, measurable impact, reflection). Penalize vague stories with no concrete result.",
  },
  DEBUG: {
    key: "DEBUG",
    label: "Debug / code read",
    blurb: "Find the bug or flaw in a snippet.",
    answerMode: "code",
    isMcq: false,
    genGuidance:
      "Present a short backend code snippet (or pseudo-code) containing a real bug, race condition, or design flaw. Ask the candidate to identify and fix it.",
    gradeGuidance:
      "Reward correctly locating the root cause, explaining why it fails, and a correct fix. Penalize fixing symptoms or missing the real bug.",
  },
  ESTIMATION: {
    key: "ESTIMATION",
    label: "Estimation",
    blurb: "Back-of-envelope capacity / scale math.",
    answerMode: "text",
    isMcq: false,
    genGuidance:
      "Pose a capacity-estimation problem (QPS, storage, bandwidth, memory). Provide a few given numbers. Ask for a reasoned estimate with assumptions.",
    gradeGuidance:
      "Reward explicit assumptions, correct order-of-magnitude math, and sensible unit handling. Exact numbers matter less than sound reasoning and right magnitude.",
  },
  QUIZ: {
    key: "QUIZ",
    label: "Quick quiz (MCQ)",
    blurb: "Single-best-answer multiple choice.",
    answerMode: "mcq",
    isMcq: true,
    genGuidance:
      "Write one single-best-answer multiple-choice question with exactly 4 options. Exactly one is correct; the others are plausible distractors. The referenceAnswer MUST be the full text of the correct option.",
    gradeGuidance:
      "The answer is correct only if it matches the correct option. Score 100 if correct, 0 if not. Briefly explain why the right answer is right and the others wrong.",
  },
};

export const QUESTION_TYPE_LIST: QuestionTypeDef[] = Object.values(QUESTION_TYPES);

export type Difficulty = "intro" | "core" | "advanced";
export const DIFFICULTIES: Difficulty[] = ["intro", "core", "advanced"];

export function isQuestionType(v: string): v is QuestionTypeKey {
  return v in QUESTION_TYPES;
}

// MCQ choices are stored as a JSON string (or null). Parse defensively:
// null/empty/malformed/non-string-array all collapse to null.
export function parseChoices(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    const strings = v.filter((x): x is string => typeof x === "string");
    return strings.length > 0 ? strings : null;
  } catch {
    return null;
  }
}
