import type { Metadata } from "next";
import { TIERS } from "@/lib/taxonomy";
import { getProgressSummary } from "@/lib/progress";
import { TopicIndex } from "@/components/TopicIndex";

export const metadata: Metadata = {
  title: "Practice — Senior Backend Interview Prep",
  description: "Drill any topic with spaced-repetition practice questions across 10 question types.",
};

export const dynamic = "force-dynamic";

export default async function PracticeIndexPage() {
  const { perTopic } = await getProgressSummary();
  const usedTiers = TIERS.filter((tier) => perTopic.some((t) => t.tier === tier.tier));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Practice</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Drill a topic.</h1>
        <p className="text-muted mt-2 max-w-2xl">
          Pick a topic, choose a question type, and self-grade with spaced repetition. Pick where you&apos;re weak.
        </p>
      </section>
      <section>
        <h2 className="sr-only">Topics</h2>
        <TopicIndex tiers={usedTiers} topics={perTopic} mode="practice" />
      </section>
    </div>
  );
}
