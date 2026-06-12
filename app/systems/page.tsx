import type { Metadata } from "next";
import Link from "next/link";
import { TOPICS, SYSTEM_SLUGS } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "System Design Builds — Senior Backend Interview Prep",
  description:
    "End-to-end system design stories: knowledge, architecture, estimation, and tradeoff decisions for real-world systems.",
};

const systems = SYSTEM_SLUGS.map((slug) => TOPICS.find((t) => t.slug === slug)!);

export default function SystemsPage() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="font-mono text-xs uppercase tracking-wider text-accent">
          Deep dives
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">
          System Design Builds
        </h1>
        <p className="text-muted mt-2 max-w-2xl">
          Each build is a complete story — from foundational knowledge through
          high-level design, capacity estimation, and tradeoff decisions. Read
          them end-to-end or jump to any section.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {systems.map((t) => (
          <Link
            key={t.slug}
            href={`/systems/${t.slug}`}
            className="group flex flex-col gap-2 rounded-lg border border-border p-5 hover:bg-surface transition-colors"
          >
            <h2 className="text-lg font-bold tracking-tight group-hover:text-accent transition-colors">
              {t.name}
            </h2>
            <p className="text-sm text-muted flex-1">{t.description}</p>
            <span className="text-xs font-medium text-accent mt-2">
              Read full story →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
