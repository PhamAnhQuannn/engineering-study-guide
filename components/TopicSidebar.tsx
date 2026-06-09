"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TIERS, TOPICS } from "@/lib/taxonomy";

// Persistent topic tree (GfG-style) for inner pages. Highlights the current topic.
export function TopicSidebar() {
  const pathname = usePathname();
  const m = pathname.match(/\/topic\/([^/]+)/);
  const current = m?.[1];
  // Mode-aware: stay in the current mode when navigating topics.
  const mode = pathname.endsWith("/practice") ? "practice" : "study";
  const hrefFor = (slug: string) => `/topic/${slug}/${mode}`;

  return (
    <nav aria-label="Topics" className="text-sm">
      <div className="lg:sticky lg:top-16 max-h-[calc(100vh-5rem)] overflow-y-auto pr-2">
        {TIERS.filter((tier) => TOPICS.some((t) => t.tier === tier.tier)).map((tier) => (
          <div key={tier.tier} className="mb-3">
            <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted px-2 py-1">
              T{tier.tier} · {tier.name}
            </div>
            <ul>
              {TOPICS.filter((t) => t.tier === tier.tier).map((t) => {
                const active = t.slug === current;
                return (
                  <li key={t.slug}>
                    <Link
                      href={hrefFor(t.slug)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded px-2 py-1 transition-colors ${
                        active
                          ? "bg-accent/10 text-accent border-l-2 border-accent"
                          : "text-muted hover:text-foreground hover:bg-surface-2 border-l-2 border-transparent"
                      }`}
                    >
                      {t.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
