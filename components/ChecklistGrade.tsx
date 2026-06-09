"use client";

import { useEffect, useState } from "react";
import { coverage as coveragePct, suggestRating } from "@/lib/rubric";
import type { Rating } from "@/lib/spacedRepetition";

// Tickable senior-answer rubric. Reports coverage % + suggested rating up to the
// parent (RevealPanel owns the rating buttons). Renders nothing if rubric empty
// (graceful degrade — parent shows manual rating). See docs/design/wireframes/checklist-grade.md.
export function ChecklistGrade({
  rubric,
  onChange,
}: {
  rubric: string[];
  onChange: (coveragePct: number, suggested: Rating) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => rubric.map(() => false));

  // Report the initial (0%) state once so the parent preselects a suggestion.
  useEffect(() => {
    onChange(0, suggestRating(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rubric.length === 0) return null;

  function toggle(i: number) {
    const next = checked.map((v, j) => (j === i ? !v : v));
    setChecked(next);
    const pct = coveragePct(next.filter(Boolean).length, rubric.length);
    onChange(pct, suggestRating(pct));
  }

  const pct = coveragePct(checked.filter(Boolean).length, rubric.length);
  const suggested = suggestRating(pct);

  return (
    <fieldset className="rounded-lg border border-border bg-surface p-4">
      <legend className="px-1 text-sm font-semibold">What a strong answer covers</legend>
      <ul className="flex flex-col gap-1">
        {rubric.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-2 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-1 h-4 w-4 accent-cyan-500"
              />
              <span className="text-sm">{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm opacity-70" aria-live="polite">
        Coverage {pct}% · Suggested: <span className="font-medium capitalize">{suggested}</span>
      </p>
    </fieldset>
  );
}
