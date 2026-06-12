"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { TIERS, TOPICS, orderIndex } from "@/lib/taxonomy";
import { SidebarTierGroup } from "@/components/SidebarTierGroup";

export interface TopicProgress {
  slug: string;
  avgScore: number | null;
  due: boolean;
  attempts: number;
}

const usedTiers = TIERS.filter((tier) => TOPICS.some((t) => t.tier === tier.tier));

function topicsForTier(tier: number) {
  return TOPICS.filter((t) => t.tier === tier).sort(
    (a, b) => orderIndex(a.slug) - orderIndex(b.slug),
  );
}

export function TopicSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const m = pathname.match(/\/topic\/([^/]+)/);
  const current = m?.[1];
  const mode = pathname.endsWith("/practice") ? "practice" : "study";

  const activeTier = current ? TOPICS.find((t) => t.slug === current)?.tier : undefined;

  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(activeTier != null ? [activeTier] : []),
  );

  const [progressMap, setProgressMap] = useState<Map<string, TopicProgress>>(new Map());

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then((data) => {
        if (data?.perTopic) {
          const map = new Map<string, TopicProgress>(
            data.perTopic.map((p: TopicProgress) => [p.slug, p]),
          );
          setProgressMap(map);
        }
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (activeTier != null && !expanded.has(activeTier)) {
      setExpanded((prev) => new Set(prev).add(activeTier));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTier]);

  const toggle = (tier: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  const allExpanded = usedTiers.every((t) => expanded.has(t.tier));
  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set(activeTier != null ? [activeTier] : []));
    } else {
      setExpanded(new Set(usedTiers.map((t) => t.tier)));
    }
  };

  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      requestAnimationFrame(() => {
        activeRef.current?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      });
    }
  }, [current]);

  return (
    <nav aria-label="Topics" className="text-sm">
      <div className="flex items-center justify-between px-3 pb-3 mb-2 border-b border-border/40">
        <span className="font-mono text-xs text-muted">
          {TOPICS.length} topics · {usedTiers.length} tiers
        </span>
        <button
          onClick={toggleAll}
          className="font-mono text-[0.65rem] text-muted hover:text-foreground transition-colors"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      {usedTiers.map((tier, i) => (
        <SidebarTierGroup
          key={tier.tier}
          tier={tier}
          topics={topicsForTier(tier.tier)}
          current={current}
          mode={mode}
          expanded={expanded.has(tier.tier)}
          onToggle={() => toggle(tier.tier)}
          activeRef={activeRef}
          onNavigate={onNavigate}
          isLast={i === usedTiers.length - 1}
          progressMap={progressMap}
        />
      ))}
    </nav>
  );
}
