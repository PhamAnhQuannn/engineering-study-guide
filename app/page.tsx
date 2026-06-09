import Link from "next/link";
import { TIERS } from "@/lib/taxonomy";
import { getProgressSummary } from "@/lib/progress";
import { scoreColor } from "@/lib/score";
import { Stat } from "@/components/Stat";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { overall, perTopic, weakAreas, dueForReview } = await getProgressSummary();
  const byTier = new Map<number, typeof perTopic>();
  for (const t of perTopic) {
    if (!byTier.has(t.tier)) byTier.set(t.tier, []);
    byTier.get(t.tier)!.push(t);
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl font-bold">Senior Backend Interview Prep</h1>
        <p className="opacity-70 mt-1">
          Practice every topic from fundamentals to product. Self-graded with spaced repetition — fully offline.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Attempts" value={String(overall.totalAttempts)} />
          <Stat
            label="Avg score"
            value={overall.avgScore != null ? `${overall.avgScore}` : "—"}
            className={scoreColor(overall.avgScore)}
          />
          <Stat label="Topics started" value={`${overall.topicsAttempted}/${overall.totalTopics}`} />
          <Stat label="Due for review" value={String(dueForReview.length)} />
        </div>
      </section>

      {(dueForReview.length > 0 || weakAreas.length > 0) && (
        <section className="grid sm:grid-cols-2 gap-4">
          {dueForReview.length > 0 && (
            <Panel title="Due for review">
              {dueForReview.slice(0, 6).map((t) => (
                <Link key={t.slug} href={`/topic/${t.slug}`} className="flex justify-between hover:underline">
                  <span>{t.name}</span>
                  <span className={scoreColor(t.avgScore)}>{t.avgScore ?? "—"}</span>
                </Link>
              ))}
            </Panel>
          )}
          {weakAreas.length > 0 && (
            <Panel title="Weak areas">
              {weakAreas.slice(0, 6).map((t) => (
                <Link key={t.slug} href={`/topic/${t.slug}`} className="flex justify-between hover:underline">
                  <span>{t.name}</span>
                  <span className={scoreColor(t.avgScore)}>{t.avgScore ?? "—"}</span>
                </Link>
              ))}
            </Panel>
          )}
        </section>
      )}

      {TIERS.map((tier) => {
        const topics = byTier.get(tier.tier) ?? [];
        if (topics.length === 0) return null;
        return (
          <section key={tier.tier}>
            <h2 className="text-lg font-semibold">
              <span className="opacity-40 mr-2">T{tier.tier}</span>
              {tier.name}
            </h2>
            <p className="text-sm opacity-60">{tier.blurb}</p>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/topic/${t.slug}`}
                  className="rounded-lg border border-black/10 dark:border-white/15 p-3 hover:border-black/30 dark:hover:border-white/40 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium">{t.name}</span>
                    {t.attempts > 0 && (
                      <span className={`text-sm font-semibold ${scoreColor(t.avgScore)}`}>
                        {t.avgScore}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs opacity-50 flex gap-2">
                    <span>{t.difficulty}</span>
                    {t.attempts > 0 && <span>· {t.attempts} attempts</span>}
                    {t.due && <span className="text-amber-600 dark:text-amber-400">· due</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="flex flex-col gap-1 text-sm">{children}</div>
    </div>
  );
}
