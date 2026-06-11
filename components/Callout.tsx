import type { ReactNode } from "react";

type CalloutType = "note" | "tip" | "warning" | "important";

const ICONS: Record<CalloutType, string> = {
  note: "ℹ️",
  tip: "💡",
  warning: "⚠️",
  important: "⭐",
};

const TITLES: Record<CalloutType, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  important: "Important",
};

export function Callout({ type, title, children }: { type: CalloutType; title?: string; children: ReactNode }) {
  return (
    <div className={`callout callout-${type}`}>
      <div className="callout-title">
        <span>{ICONS[type]}</span>
        {title ?? TITLES[type]}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
