import type { Metadata } from "next";
import Link from "next/link";
import { TIERS } from "@/lib/taxonomy";
import { getProgressSummary } from "@/lib/progress";
import { scoreColor } from "@/lib/score";
import { Stat } from "@/components/Stat";
import { TopicIndex } from "@/components/TopicIndex";

export const metadata: Metadata = {
  title: "Knowledge — Senior Backend Interview Prep",
  description: "Learn every senior backend topic from concept to code — fully offline.",
};

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { overall, perTopic, dueForReview } = await getProgressSummary();
  const usedTiers = TIERS.filter((tier) => perTopic.some((t) => t.tier === tier.tier));

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Knowledge</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">
          Learn every topic, concept to code.
        </h1>
        <p className="text-muted mt-2 max-w-2xl">
          Pick a topic to read its article — core concept, how &amp; when to use it, real code, real-world examples,
          and effect. {perTopic.length} topics · fully offline.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Stat label="Topics" value={String(perTopic.length)} />
          <Stat label="Started" value={`${overall.topicsAttempted}/${overall.totalTopics}`} />
          <Stat
            label="Avg score"
            value={overall.avgScore != null ? `${overall.avgScore}` : "—"}
            className={scoreColor(overall.avgScore)}
          />
          <Stat label="Due" value={String(dueForReview.length)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/learning-paths"
            className="rounded-md bg-accent text-accent-foreground px-6 py-3 font-medium hover:opacity-90 transition-opacity"
          >
            Start here: guided paths →
          </Link>
          <Link
            href="/practice"
            className="rounded-md border border-border px-5 py-2.5 hover:bg-surface-2 transition-colors"
          >
            Practice questions →
          </Link>
          <Link
            href="/mock"
            className="rounded-md border border-border px-5 py-2.5 hover:bg-surface-2 transition-colors"
          >
            Mock interview →
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted">No account needed · works offline</p>
      </section>

      <section>
        <h2 className="sr-only">Topics</h2>
        <TopicIndex tiers={usedTiers} topics={perTopic} mode="knowledge" />
      </section>
    </div>
  );
}
