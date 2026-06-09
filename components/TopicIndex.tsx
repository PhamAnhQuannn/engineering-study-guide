"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { scoreColor } from "@/lib/score";

interface TopicRow {
  slug: string;
  name: string;
  tier: number;
  difficulty: string;
  attempts: number;
  avgScore: number | null;
  due: boolean;
}
interface Tier {
  tier: number;
  name: string;
  blurb: string;
}

// Topic-first searchable index (GfG-style). Client-side instant filter, offline.
// mode decides where a topic links: knowledge article vs practice runner.
export function TopicIndex({
  tiers,
  topics,
  mode = "knowledge",
}: {
  tiers: Tier[];
  topics: TopicRow[];
  mode?: "knowledge" | "practice";
}) {
  const [q, setQ] = useState("");
  const hrefFor = (slug: string) =>
    mode === "practice" ? `/topic/${slug}/practice` : `/topic/${slug}/study`;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (t: TopicRow, tierName: string) =>
      !needle ||
      t.name.toLowerCase().includes(needle) ||
      tierName.toLowerCase().includes(needle);
    return tiers
      .map((tier) => ({
        tier,
        items: topics.filter((t) => t.tier === tier.tier && match(t, tier.name)),
      }))
      .filter((g) => g.items.length > 0);
  }, [q, tiers, topics]);

  const total = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-accent">
          ⌁
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topics…"
          aria-label="Search topics"
          className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2.5 outline-none focus:border-accent"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted num">
          {total}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted">No topics match “{q}”.</p>
      ) : (
        groups.map(({ tier, items }) => (
          <section key={tier.tier}>
            <h2 className="flex items-baseline gap-2 text-sm font-semibold">
              <span className="font-mono text-accent">T{tier.tier}</span>
              {tier.name}
              <span className="font-mono text-xs text-muted num">{items.length}</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">{tier.blurb}</p>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-surface">
              {items.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={hrefFor(t.slug)}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors"
                  >
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">
                      {t.difficulty}
                    </span>
                    {t.due && (
                      <span className="font-mono text-[0.65rem] uppercase tracking-wider text-amber-500">
                        due
                      </span>
                    )}
                    {t.attempts > 0 && (
                      <span className={`num text-sm font-semibold w-8 text-right ${scoreColor(t.avgScore)}`}>
                        {t.avgScore}
                      </span>
                    )}
                    <span className="text-muted">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
