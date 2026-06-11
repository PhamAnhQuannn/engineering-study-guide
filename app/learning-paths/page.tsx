import type { Metadata } from "next";
import Link from "next/link";
import { SPINES, TOPICS } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Learning Paths — Senior Backend Interview Prep",
  description: "Follow guided paths through ShopFast — from first decision to hundreds of millions of users.",
};

export const dynamic = "force-dynamic";

const NAME = new Map(TOPICS.map((t) => [t.slug, t.name]));

export default function LearningPathsPage() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="font-mono text-xs uppercase tracking-wider text-accent">Start here</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">Guided learning paths</h1>
        <p className="text-muted mt-2 max-w-2xl">
          Not sure where to begin? Follow one running system — <strong>ShopFast</strong>, an online store — as it
          grows from first decision to hundreds of millions of users. Each path threads its topics in reading order,
          so every concept builds on the last. Or jump straight to any{" "}
          <Link href="/knowledge" className="text-accent hover:underline">
            topic
          </Link>
          .
        </p>
      </section>

      {SPINES.map((spine, i) => (
        <section key={spine.slug} className="rounded-lg border border-border p-5">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight">
              <span className="text-muted font-mono text-sm mr-2">{i + 1}.</span>
              {spine.name}
            </h2>
            <span className="font-mono text-xs text-muted">
              Tiers {spine.tiers.join("–")} · {spine.topics.length} topics
            </span>
          </div>
          <p className="text-muted mt-1 max-w-2xl">{spine.blurb}</p>

          <ol className="mt-4 flex flex-col gap-1">
            {spine.topics.map((slug, n) => (
              <li key={slug} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[0.7rem] text-muted w-6 text-right">{n + 1}</span>
                <Link href={`/topic/${slug}/study`} className="hover:text-accent transition-colors">
                  {NAME.get(slug) ?? slug}
                </Link>
              </li>
            ))}
          </ol>

          <Link
            href={`/topic/${spine.topics[0]}/study`}
            className="mt-4 inline-block rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Begin: {NAME.get(spine.topics[0]) ?? spine.topics[0]} →
          </Link>
        </section>
      ))}
    </div>
  );
}
