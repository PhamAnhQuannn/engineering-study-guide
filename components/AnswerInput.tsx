"use client";

import dynamic from "next/dynamic";
import { QUESTION_TYPES, type QuestionTypeKey } from "@/lib/questionTypes";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function AnswerInput({
  type,
  choices,
  value,
  onChange,
  disabled,
}: {
  type: QuestionTypeKey;
  choices: string[] | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const mode = QUESTION_TYPES[type].answerMode;

  if (mode === "mcq" && choices) {
    return (
      <div className="flex flex-col gap-2">
        {choices.map((c) => (
          <label
            key={c}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              value === c
                ? "border-blue-500 bg-blue-500/10"
                : "border-black/10 dark:border-white/15 hover:border-black/30 dark:hover:border-white/40"
            } ${disabled ? "pointer-events-none opacity-70" : ""}`}
          >
            <input
              type="radio"
              name="mcq"
              className="mt-1"
              checked={value === c}
              onChange={() => onChange(c)}
              disabled={disabled}
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
    );
  }

  if (mode === "code") {
    return (
      <div className="rounded-lg border border-black/10 dark:border-white/15 overflow-hidden">
        <MonacoEditor
          height="320px"
          defaultLanguage="python"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            readOnly: disabled,
          }}
        />
      </div>
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={10}
      placeholder="Type your answer…"
      className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent p-3 outline-none focus:border-blue-500 disabled:opacity-70"
    />
  );
}
