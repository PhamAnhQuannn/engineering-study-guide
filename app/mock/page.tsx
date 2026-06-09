"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnswerInput } from "@/components/AnswerInput";
import { RevealPanel } from "@/components/RevealPanel";
import { Markdown } from "@/components/Markdown";
import { MOCK_TEMPLATES, scorecard, type MockItemResult } from "@/lib/mock";
import {
  QUESTION_TYPE_LIST,
  QUESTION_TYPES,
  type QuestionTypeKey,
} from "@/lib/questionTypes";
import { TIERS } from "@/lib/taxonomy";
import { scoreForRating, type Rating } from "@/lib/spacedRepetition";

interface MockItem {
  id: string;
  prompt: string;
  choices: string[] | null;
  type: QuestionTypeKey;
  referenceAnswer: string;
  rubric: string[];
  topic: { slug: string; name: string };
}
interface AnswerMeta {
  text: string;
  timeTakenSec: number;
  overTime: boolean;
  skipped: boolean;
}
type Phase = "setup" | "loading" | "answering" | "reviewing" | "scorecard" | "error";

function fmtClock(sec: number): string {
  const neg = sec < 0;
  const s = Math.abs(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${neg ? "+" : ""}${m}:${String(r).padStart(2, "0")}`;
}

export default function MockPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState("");
  const [items, setItems] = useState<MockItem[]>([]);
  const [perQuestionSec, setPerQuestionSec] = useState(300);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [metas, setMetas] = useState<AnswerMeta[]>([]);
  const [results, setResults] = useState<MockItemResult[]>([]);
  const [busy, setBusy] = useState(false);

  async function start(payload: object) {
    setPhase("loading");
    setError("");
    try {
      const res = await fetch("/api/mock/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start mock.");
      setItems(data.items);
      setPerQuestionSec(data.perQuestionSec);
      setMetas([]);
      setResults([]);
      setIdx(0);
      setAnswer("");
      setPhase("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start mock.");
      setPhase("error");
    }
  }

  if (phase === "setup") return <Setup onStart={start} />;
  if (phase === "loading") return <p className="opacity-60">Building your mock…</p>;
  if (phase === "error")
    return (
      <div className="flex flex-col gap-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => setPhase("setup")} className="self-start rounded-lg border px-4 py-2">
          Back to setup
        </button>
      </div>
    );

  if (phase === "answering") {
    const recordAndAdvance = (skipped: boolean, timeTakenSec: number) => {
      const meta: AnswerMeta = {
        text: skipped ? "" : answer,
        timeTakenSec,
        overTime: timeTakenSec > perQuestionSec,
        skipped,
      };
      const nextMetas = [...metas, meta];
      setMetas(nextMetas);
      setAnswer("");
      if (idx + 1 >= items.length) {
        setIdx(0);
        setPhase("reviewing");
      } else {
        setIdx(idx + 1);
      }
    };
    return (
      <RunQuestion
        key={idx}
        item={items[idx]}
        index={idx}
        total={items.length}
        perQuestionSec={perQuestionSec}
        answer={answer}
        onAnswer={setAnswer}
        onSubmit={(t) => recordAndAdvance(false, t)}
        onSkip={(t) => recordAndAdvance(true, t)}
        onEnd={() => setPhase(metas.length ? "reviewing" : "setup")}
      />
    );
  }

  if (phase === "reviewing") {
    const item = items[idx];
    const meta = metas[idx];
    const isMcq = item.type === "QUIZ";

    const finish = (result: MockItemResult, rating: Rating) => {
      setBusy(true);
      fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: item.id,
          rating,
          coverage: result.score,
        }),
      }).finally(() => {
        setBusy(false);
        const next = [...results, result];
        setResults(next);
        if (idx + 1 >= items.length) setPhase("scorecard");
        else setIdx(idx + 1);
      });
    };

    const base = {
      type: item.type,
      topicSlug: item.topic.slug,
      topicName: item.topic.name,
      timeTakenSec: meta.timeTakenSec,
      overTime: meta.overTime,
      skipped: meta.skipped,
    };

    const correct =
      isMcq && !meta.skipped && meta.text.trim() === item.referenceAnswer.trim();

    return (
      <div className="flex flex-col gap-5">
        <div className="flex justify-between text-sm">
          <span className="opacity-60">
            Review {idx + 1} / {items.length} · {item.topic.name}
          </span>
          <span className="opacity-50">
            your time {fmtClock(meta.timeTakenSec)} {meta.overTime ? "⚑ over" : ""}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <Markdown>{item.prompt}</Markdown>
        </div>
        <div>
          <p className="text-sm opacity-60 mb-1">Your answer{meta.skipped ? " (skipped)" : ""}:</p>
          <pre className="whitespace-pre-wrap text-sm rounded-lg border border-border bg-surface p-3 min-h-[3rem]">
            {meta.text || "—"}
          </pre>
        </div>

        {isMcq ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h3 className="font-semibold mb-2">Correct answer</h3>
              <Markdown>{item.referenceAnswer}</Markdown>
            </div>
            <p className={correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {meta.skipped ? "⚠ Skipped" : correct ? "✓ Correct (100)" : "✗ Incorrect (0)"}
            </p>
            <button
              disabled={busy}
              onClick={() =>
                finish({ ...base, score: correct ? 100 : 0 }, correct ? "good" : "again")
              }
              className="self-start rounded-lg bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        ) : (
          <RevealPanel
            answer={item.referenceAnswer}
            rubric={item.rubric}
            busy={busy}
            onRate={(rating, coverage) =>
              finish({ ...base, score: coverage ?? scoreForRating(rating) }, rating)
            }
          />
        )}
      </div>
    );
  }

  // scorecard
  const card = scorecard(results);
  return <Scorecard card={card} onDone={() => setPhase("setup")} />;
}

// ---- Setup ----
function Setup({ onStart }: { onStart: (payload: object) => void }) {
  const [custom, setCustom] = useState(false);
  const [types, setTypes] = useState<QuestionTypeKey[]>(["KNOWLEDGE", "CODING"]);
  const [tiers, setTiers] = useState<number[]>([]);
  const [count, setCount] = useState(5);
  const [minutes, setMinutes] = useState(5);

  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mock interview</h1>
        <p className="opacity-70 mt-1">Rehearse a realistic loop. Timed, self-graded, fully offline.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {MOCK_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onStart({ templateId: t.id })}
            className="text-left rounded-lg border border-border bg-surface p-4 hover:border-accent/50"
          >
            <div className="font-medium">{t.label}</div>
            <div className="text-xs opacity-60 mt-1">{t.blurb}</div>
          </button>
        ))}
        <button
          onClick={() => setCustom((c) => !c)}
          className={`text-left rounded-md border p-4 ${custom ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/50"}`}
        >
          <div className="font-medium">Custom</div>
          <div className="text-xs opacity-60 mt-1">Build your own</div>
        </button>
      </div>

      {custom && (
        <div className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold mb-2">Question types</p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPE_LIST.map((d) => (
                <label key={d.key} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={types.includes(d.key)} onChange={() => toggle(types, d.key, setTypes)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Tiers (optional)</p>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => (
                <label key={t.tier} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={tiers.includes(t.tier)} onChange={() => toggle(tiers, t.tier, setTiers)} />
                  T{t.tier}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-4 items-center text-sm">
            <label className="flex items-center gap-2">
              Count
              <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-16 rounded border border-border px-2 py-1 bg-transparent" />
            </label>
            <label className="flex items-center gap-2">
              Min/question
              <input type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-16 rounded border border-border px-2 py-1 bg-transparent" />
            </label>
          </div>
          <button
            disabled={types.length === 0}
            onClick={() => onStart({ config: { types, tiers, count, perQuestionSec: minutes * 60 } })}
            className="self-start rounded-lg bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90 disabled:opacity-40"
          >
            Start custom mock →
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Run question (timed) ----
function RunQuestion({
  item,
  index,
  total,
  perQuestionSec,
  answer,
  onAnswer,
  onSubmit,
  onSkip,
  onEnd,
}: {
  item: MockItem;
  index: number;
  total: number;
  perQuestionSec: number;
  answer: string;
  onAnswer: (v: string) => void;
  onSubmit: (timeTakenSec: number) => void;
  onSkip: (timeTakenSec: number) => void;
  onEnd: () => void;
}) {
  const [remaining, setRemaining] = useState(perQuestionSec);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(perQuestionSec);
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [perQuestionSec]);

  const elapsed = () => Math.round((Date.now() - startRef.current) / 1000);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center text-sm">
        <span className="opacity-60">
          Q {index + 1} / {total} · {QUESTION_TYPES[item.type].label}
        </span>
        <span
          className={remaining < 0 ? "text-red-600 dark:text-red-400 font-medium" : "opacity-70"}
          role="timer"
          aria-live="off"
        >
          {fmtClock(remaining)} {remaining < 0 ? "over" : "left"}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <Markdown>{item.prompt}</Markdown>
      </div>

      <AnswerInput type={item.type} choices={item.choices} value={answer} onChange={onAnswer} />

      <div className="flex gap-3">
        <button onClick={() => onSkip(elapsed())} className="rounded-lg border border-border px-4 py-2">
          Skip
        </button>
        <button onClick={() => onSubmit(elapsed())} className="rounded-lg bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90">
          Submit &amp; next →
        </button>
        <button onClick={onEnd} className="ml-auto text-sm opacity-50 hover:opacity-100">
          End mock
        </button>
      </div>
      <p className="text-xs opacity-50">Model answers are revealed after the whole run.</p>
    </div>
  );
}

// ---- Scorecard ----
function Bar({ label, value, weak }: { label: string; value: number; weak?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 truncate">{label}</span>
      <span className="flex-1 h-2 rounded bg-surface-2 overflow-hidden">
        <span className="block h-full bg-accent" style={{ width: `${value}%` }} />
      </span>
      <span className="w-14 text-right font-medium">{value}</span>
      {weak && <span className="text-amber-600 dark:text-amber-400">⚑</span>}
    </div>
  );
}

function Scorecard({ card, onDone }: { card: ReturnType<typeof scorecard>; onDone: () => void }) {
  if (card.total === 0)
    return (
      <div className="flex flex-col gap-4">
        <p className="opacity-70">No graded questions.</p>
        <button onClick={onDone} className="self-start rounded-lg border px-4 py-2">Back to setup</button>
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mock complete</h1>
        <p className="opacity-70 mt-1">
          Overall <span className="font-bold">{card.overall}</span> · {card.graded}/{card.total} graded
          {card.overTime ? ` · ⏱ ${card.overTime} over time` : ""}
          {card.skipped ? ` · ${card.skipped} skipped` : ""}
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">By type</h2>
        <div className="flex flex-col gap-1">
          {card.byType.map((b) => (
            <Bar key={b.key} label={QUESTION_TYPES[b.key as QuestionTypeKey]?.label ?? b.key} value={b.avg} weak={b.avg < 60} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">By topic</h2>
        <div className="flex flex-col gap-1">
          {card.byTopic.map((b) => (
            <Bar key={b.key} label={b.label} value={b.avg} weak={b.avg < 60} />
          ))}
        </div>
      </section>

      {card.weak.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Weak areas → practice</h2>
          <div className="flex flex-col gap-1 text-sm">
            {card.weak.map((b) => (
              <Link key={b.key} href={`/topic/${b.key}`} className="hover:underline">
                {b.label} ({b.avg})
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <button onClick={onDone} className="rounded-lg bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90">
          Done
        </button>
        <Link href="/progress" className="rounded-lg border border-border px-4 py-2.5">
          View progress
        </Link>
      </div>
    </div>
  );
}
