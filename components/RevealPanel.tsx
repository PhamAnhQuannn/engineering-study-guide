"use client";

import { Markdown } from "./Markdown";
import type { Rating } from "@/lib/spacedRepetition";

export function RevealPanel({
  answer,
  onRate,
  busy,
}: {
  answer: string;
  onRate: (r: Rating) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
        <h3 className="font-semibold mb-2">Model answer</h3>
        <Markdown>{answer}</Markdown>
      </div>

      <div>
        <p className="text-sm opacity-60 mb-2">How well did you know it?</p>
        <div className="flex gap-3">
          <RateButton
            label="Again"
            hint="< today"
            color="border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10"
            onClick={() => onRate("again")}
            disabled={busy}
          />
          <RateButton
            label="Good"
            hint="3 days"
            color="border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            onClick={() => onRate("good")}
            disabled={busy}
          />
          <RateButton
            label="Easy"
            hint="2 weeks"
            color="border-green-500 text-green-600 dark:text-green-400 hover:bg-green-500/10"
            onClick={() => onRate("easy")}
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
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center rounded-lg border px-6 py-2.5 transition-colors disabled:opacity-40 ${color}`}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs opacity-60">{hint}</span>
    </button>
  );
}
