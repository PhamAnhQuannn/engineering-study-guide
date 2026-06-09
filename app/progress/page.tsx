import Link from "next/link";
import { getProgressSummary } from "@/lib/progress";
import { scoreColor } from "@/lib/score";
import { Stat } from "@/components/Stat";

export const dynamic = "force-dynamic";

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function ProgressPage() {
  const { overall, perTopic, weakAreas, dueForReview } = await getProgressSummary();
  const attempted = perTopic.filter((t) => t.attempts > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
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
      </div>

      {dueForReview.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">
              ⏰ {dueForReview.length} topic{dueForReview.length > 1 ? "s" : ""} due for review
            </p>
            <p className="text-sm opacity-70">
              Most overdue:{" "}
              {dueForReview.slice(0, 4).map((t) => t.name).join(", ")}
            </p>
          </div>
          <Link
            href={`/topic/${dueForReview[0].slug}`}
            className="shrink-0 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Review now →
          </Link>
        </div>
      )}

      {weakAreas.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Weak areas (avg &lt; 70)</h2>
          <div className="flex flex-col gap-1 text-sm">
            {weakAreas.slice(0, 8).map((t) => (
              <Link
                key={t.slug}
                href={`/topic/${t.slug}`}
                className="flex justify-between hover:underline"
              >
                <span>
                  {t.name} <span className="opacity-50">⚑ weak</span>
                </span>
                <span className={`font-semibold ${scoreColor(t.avgScore)}`}>{t.avgScore}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {attempted.length === 0 ? (
        <p className="opacity-60">
          No attempts yet. <Link href="/" className="underline">Pick a topic</Link> to start.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-60 border-b border-black/10 dark:border-white/15">
                <th className="py-2 pr-4">Topic</th>
                <th className="py-2 pr-4">Attempts</th>
                <th className="py-2 pr-4">Avg</th>
                <th className="py-2 pr-4">Last</th>
                <th className="py-2 pr-4">Next review</th>
              </tr>
            </thead>
            <tbody>
              {attempted.map((t) => (
                <tr key={t.slug} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2 pr-4">
                    <Link href={`/topic/${t.slug}`} className="hover:underline">
                      {t.name}
                    </Link>
                    {t.due && <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">due</span>}
                  </td>
                  <td className="py-2 pr-4">{t.attempts}</td>
                  <td className={`py-2 pr-4 font-semibold ${scoreColor(t.avgScore)}`}>{t.avgScore}</td>
                  <td className="py-2 pr-4 opacity-70">{fmt(t.lastSeen)}</td>
                  <td className="py-2 pr-4 opacity-70">{fmt(t.nextDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
