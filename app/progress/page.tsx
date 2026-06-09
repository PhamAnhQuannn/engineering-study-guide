import Link from "next/link";
import { getProgressSummary } from "@/lib/progress";

export const dynamic = "force-dynamic";

function scoreColor(score: number | null): string {
  if (score == null) return "opacity-40";
  if (score < 50) return "text-red-600 dark:text-red-400";
  if (score < 70) return "text-amber-600 dark:text-amber-400";
  if (score < 85) return "text-blue-600 dark:text-blue-400";
  return "text-green-600 dark:text-green-400";
}

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function ProgressPage() {
  const { overall, perTopic } = await getProgressSummary();
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
        </div>
      </div>

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

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-3">
      <div className="text-xs opacity-60">{label}</div>
      <div className={`text-xl font-bold ${className}`}>{value}</div>
    </div>
  );
}
