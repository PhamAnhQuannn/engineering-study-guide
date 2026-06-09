"use client";

import { useCallback, useEffect, useState } from "react";
import { AnswerInput } from "@/components/AnswerInput";
import { RevealPanel } from "@/components/RevealPanel";
import { Markdown } from "@/components/Markdown";
import { QUESTION_TYPES, type QuestionTypeKey } from "@/lib/questionTypes";
import type { Rating } from "@/lib/spacedRepetition";

interface ActiveQuestion {
  id: string;
  prompt: string;
  choices: string[] | null;
  type: QuestionTypeKey;
  referenceAnswer: string;
  rubric: string[];
  topic: { slug: string; name: string };
}
type Status = "idle" | "loading" | "answering" | "revealed" | "error";

export function PracticeRunner({
  slug,
  availableTypes,
}: {
  slug: string;
  availableTypes: { type: QuestionTypeKey; count: number }[];
}) {
  const [type, setType] = useState<QuestionTypeKey | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [question, setQuestion] = useState<ActiveQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadQuestion = useCallback(async (t: QuestionTypeKey) => {
    setStatus("loading");
    setAnswer("");
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSlug: slug, type: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load question.");
      setQuestion(data);
      setStatus("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load question.");
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    if (type) loadQuestion(type);
  }, [type, loadQuestion]);

  async function rate(rating: Rating, coverage?: number) {
    if (!question || !type) return;
    setBusy(true);
    try {
      await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, rating, coverage }),
      });
    } finally {
      setBusy(false);
      loadQuestion(type);
    }
  }

  // Type picker
  if (!type) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Pick a question type</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {availableTypes.map(({ type: key, count }) => {
            const def = QUESTION_TYPES[key];
            return (
              <button
                key={key}
                onClick={() => setType(key)}
                className="text-left rounded-md border border-border bg-surface p-3 hover:border-accent/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{def.label}</span>
                  <span className="num text-xs text-muted">{count}</span>
                </div>
                <div className="text-xs text-muted">{def.blurb}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const switchType = (
    <button onClick={() => setType(null)} className="text-sm text-muted hover:text-foreground">
      ← Change type
    </button>
  );

  if (status === "error") {
    return (
      <div className="flex flex-col gap-4">
        {switchType}
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => loadQuestion(type)} className="self-start rounded-md border border-border px-4 py-2">
          Retry
        </button>
      </div>
    );
  }
  if (status === "loading" || !question) return <p className="text-muted">Loading a question…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm">
        {switchType}
        <span className="text-muted">{QUESTION_TYPES[question.type].label}</span>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <Markdown>{question.prompt}</Markdown>
      </div>

      {status === "revealed" ? (
        <RevealPanel answer={question.referenceAnswer} rubric={question.rubric} onRate={rate} busy={busy} />
      ) : (
        <>
          <div>
            <p className="text-sm text-muted mb-2">Your answer (optional — for self-practice)</p>
            <AnswerInput type={question.type} choices={question.choices} value={answer} onChange={setAnswer} />
          </div>
          <button
            onClick={() => setStatus("revealed")}
            className="self-start rounded-md bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90"
          >
            Reveal answer
          </button>
        </>
      )}
    </div>
  );
}
