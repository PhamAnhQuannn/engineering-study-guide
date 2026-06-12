"use client";

import Link from "next/link";
import type { RefObject } from "react";
import type { TopicProgress } from "@/components/TopicSidebar";

interface TierDef {
  tier: number;
  name: string;
}

interface TopicSeed {
  slug: string;
  name: string;
  tier: number;
}

interface Props {
  tier: TierDef;
  topics: TopicSeed[];
  current: string | undefined;
  mode: "study" | "practice";
  expanded: boolean;
  onToggle: () => void;
  activeRef: RefObject<HTMLAnchorElement | null>;
  onNavigate?: () => void;
  isLast: boolean;
  progressMap: Map<string, TopicProgress>;
}

const TIER_COLORS: Record<number, string> = {
  1: "border-l-green-500/60",
  2: "border-l-green-500/60",
  3: "border-l-green-500/60",
  4: "border-l-blue-500/60",
  5: "border-l-blue-500/60",
  6: "border-l-blue-500/60",
  7: "border-l-purple-500/60",
  8: "border-l-purple-500/60",
  9: "border-l-purple-500/60",
  10: "border-l-amber-500/60",
  11: "border-l-amber-500/60",
  12: "border-l-amber-500/60",
};

function ProgressDot({ progress }: { progress: TopicProgress | undefined }) {
  if (!progress || progress.attempts === 0) return null;

  if (progress.due) {
    return (
      <span
        className="inline-block size-2 rounded-full bg-error shrink-0 animate-pulse"
        title="Due for review"
      />
    );
  }

  const score = progress.avgScore ?? 0;
  const color = score >= 70 ? "bg-success" : "bg-warning";
  return (
    <span
      className={`inline-block size-2 rounded-full ${color} shrink-0`}
      title={`Score: ${score}%`}
    />
  );
}

export function SidebarTierGroup({
  tier,
  topics,
  current,
  mode,
  expanded,
  onToggle,
  activeRef,
  onNavigate,
  isLast,
  progressMap,
}: Props) {
  const headerId = `tier-${tier.tier}-header`;
  const listId = `tier-${tier.tier}-topics`;
  const tierColor = TIER_COLORS[tier.tier] ?? "border-l-transparent";

  return (
    <div className={`border-l-2 ${tierColor} ${isLast ? "" : "mb-4 pb-4 border-b border-border/40"}`}>
      <button
        id={headerId}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={listId}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground transition-colors"
      >
        <svg
          className={`size-3.5 shrink-0 transition-transform duration-[var(--dur-fast)] ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06L9.44 8 6.22 4.78a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="truncate">
          T{tier.tier} · {tier.name}
        </span>
        {!expanded && (
          <span className="ml-auto font-mono text-[0.65rem] text-muted/60 shrink-0">
            {topics.length}
          </span>
        )}
      </button>

      <ul
        id={listId}
        role="group"
        aria-labelledby={headerId}
        className="grid transition-[grid-template-rows] duration-[var(--dur-slow)] ease-[var(--ease)]"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {topics.map((t) => {
            const active = t.slug === current;
            const progress = progressMap.get(t.slug);
            return (
              <li key={t.slug} className="list-none">
                <Link
                  href={`/topic/${t.slug}/${mode}`}
                  ref={active ? activeRef : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors border-l-[3px] ${
                    active
                      ? "bg-accent/15 text-accent font-medium border-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-2 border-transparent"
                  }`}
                >
                  <ProgressDot progress={progress} />
                  <span className="truncate">{t.name}</span>
                </Link>
              </li>
            );
          })}
        </div>
      </ul>
    </div>
  );
}
