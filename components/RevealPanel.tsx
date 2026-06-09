"use client";

import { useCallback, useState } from "react";
import { Markdown } from "./Markdown";
import { ChecklistGrade } from "./ChecklistGrade";
import type { Rating } from "@/lib/spacedRepetition";

export function RevealPanel({
  answer,
  rubric = [],
  onRate,
  busy,
}: {
  answer: string;
  rubric?: string[];
  onRate: (r: Rating, coverage?: number) => void;
  busy?: boolean;
}) {
  const hasChecklist = rubric.length > 0;
  const [coverage, setCoverage] = useState(0);
  const [suggested, setSuggested] = useState<Rating>("again");

  const handleChange = useCallback((pct: number, s: Rating) => {
    setCoverage(pct);
    setSuggested(s);
  }, []);

  const rate = (r: Rating) => onRate(r, hasChecklist ? coverage : undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
        <h3 className="font-semibold mb-2">Model answer</h3>
        <Markdown>{answer}</Markdown>
      </div>

      {hasChecklist && <ChecklistGrade rubric={rubric} onChange={handleChange} />}

      <div>
        <p className="text-sm opacity-60 mb-2">
          {hasChecklist ? "Confirm your rating (or override)" : "How well did you know it?"}
        </p>
        <div className="flex gap-3">
          <RateButton
            label="Again"
            hint="< today"
            color="border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10"
            active={hasChecklist && suggested === "again"}
            onClick={() => rate("again")}
            disabled={busy}
          />
          <RateButton
            label="Good"
            hint="3 days"
            color="border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            active={hasChecklist && suggested === "good"}
            onClick={() => rate("good")}
            disabled={busy}
          />
          <RateButton
            label="Easy"
            hint="2 weeks"
            color="border-green-500 text-green-600 dark:text-green-400 hover:bg-green-500/10"
            active={hasChecklist && suggested === "easy"}
            onClick={() => rate("easy")}
            disabled={busy}
          />
        </div>
      </div>
    </div>
  );
}

function RateButton({
  label,
  hint,
  color,
  active,
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  color: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex flex-col items-center rounded-lg border px-6 py-2.5 transition-colors disabled:opacity-40 ${color} ${
        active ? "ring-2 ring-offset-2 ring-current dark:ring-offset-black" : ""
      }`}
    >
      <span className="font-medium">
        {label}
        {active ? " ·" : ""}
      </span>
      <span className="text-xs opacity-60">{hint}</span>
    </button>
  );
}
