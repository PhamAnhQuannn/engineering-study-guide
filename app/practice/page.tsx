"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnswerInput } from "@/components/AnswerInput";
import { RevealPanel } from "@/components/RevealPanel";
import { Markdown } from "@/components/Markdown";
import { QUESTION_TYPES, isQuestionType, type QuestionTypeKey } from "@/lib/questionTypes";
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

type Status = "loading" | "answering" | "revealed" | "error";

function PracticeInner() {
  const params = useSearchParams();
  const topicSlug = params.get("topicSlug") ?? "";
  const type = params.get("type") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [question, setQuestion] = useState<ActiveQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadQuestion = useCallback(async () => {
    setStatus("loading");
    setAnswer("");
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSlug, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load question.");
      setQuestion(data);
      setStatus("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load question.");
      setStatus("error");
    }
  }, [topicSlug, type]);

  useEffect(() => {
    if (!topicSlug || !isQuestionType(type)) {
      setError("Missing or invalid topic/type. Go back and pick a topic.");
      setStatus("error");
      return;
    }
    loadQuestion();
  }, [topicSlug, type, loadQuestion]);

  async function rate(rating: Rating, coverage?: number) {
    if (!question) return;
    setBusy(true);
    try {
      await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, rating, coverage }),
      });
    } finally {
      setBusy(false);
      loadQuestion();
    }
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <div className="flex gap-3">
          <button onClick={loadQuestion} className="rounded-lg border border-border px-4 py-2">
            Retry
          </button>
          <Link href="/" className="rounded-lg border border-border px-4 py-2">
            Back to topics
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading" || !question) {
    return <p className="opacity-60">Loading a question…</p>;
  }

  const typeLabel = QUESTION_TYPES[question.type].label;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/topic/${question.topic.slug}`} className="opacity-60 hover:opacity-100">
          ← {question.topic.name}
        </Link>
        <span className="opacity-50">{typeLabel}</span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <Markdown>{question.prompt}</Markdown>
      </div>

      {status === "revealed" ? (
        <RevealPanel answer={question.referenceAnswer} rubric={question.rubric} onRate={rate} busy={busy} />
      ) : (
        <>
          <div>
            <p className="text-sm opacity-60 mb-2">
              Your answer (optional — for self-practice, not graded)
            </p>
            <AnswerInput
              type={question.type}
              choices={question.choices}
              value={answer}
              onChange={setAnswer}
            />
          </div>
          <button
            onClick={() => setStatus("revealed")}
            className="self-start rounded-lg bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90"
          >
            Reveal answer
          </button>
        </>
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<p className="opacity-60">Loading…</p>}>
      <PracticeInner />
    </Suspense>
  );
}
