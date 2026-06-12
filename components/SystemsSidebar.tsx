"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SYSTEM_SLUGS, TOPICS } from "@/lib/taxonomy";

const systems = SYSTEM_SLUGS.map((slug) => TOPICS.find((t) => t.slug === slug)!);

export function SystemsSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const m = pathname.match(/\/systems\/([^/]+)/);
  const current = m?.[1];

  return (
    <nav aria-label="System builds" className="text-sm">
      <div className="flex items-center justify-between px-3 pb-3 mb-2 border-b border-border/40">
        <span className="font-mono text-xs text-muted">
          {systems.length} systems
        </span>
      </div>

      <div className="border-l-2 border-l-purple-500/60">
        <div className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted">
          System Builds
        </div>
        <ul role="list">
          {systems.map((t) => {
            const active = t.slug === current;
            return (
              <li key={t.slug}>
                <Link
                  href={`/systems/${t.slug}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex flex-col gap-0.5 rounded-md px-3 py-2 transition-colors border-l-[3px] ${
                    active
                      ? "bg-accent/15 text-accent font-medium border-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-2 border-transparent"
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  {!active && (
                    <span className="text-[0.65rem] text-muted/60 truncate">
                      {t.description}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
