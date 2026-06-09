"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTION_TYPES, type QuestionTypeKey } from "@/lib/questionTypes";

export function TopicStarter({
  slug,
  availableTypes,
}: {
  slug: string;
  availableTypes: { type: QuestionTypeKey; count: number }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<QuestionTypeKey>(availableTypes[0].type);

  function start() {
    const params = new URLSearchParams({ topicSlug: slug, type });
    router.push(`/practice?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-semibold mb-2">Question type</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {availableTypes.map(({ type: key, count }) => {
            const def = QUESTION_TYPES[key];
            const active = key === type;
            return (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  active
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-black/10 dark:border-white/15 hover:border-black/30 dark:hover:border-white/40"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{def.label}</span>
                  <span className="text-xs opacity-50">{count}</span>
                </div>
                <div className="text-xs opacity-60">{def.blurb}</div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={start}
        className="self-start rounded-lg bg-foreground text-background px-5 py-2.5 font-medium hover:opacity-90"
      >
        Start practice →
      </button>
    </div>
  );
}
