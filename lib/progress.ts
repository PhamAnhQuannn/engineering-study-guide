import { prisma } from "./db";

export interface TopicProgressView {
  slug: string;
  name: string;
  tier: number;
  difficulty: string;
  attempts: number;
  avgScore: number | null;
  lastSeen: Date | null;
  nextDue: Date | null;
  due: boolean;
}

export interface ProgressSummary {
  overall: {
    totalAttempts: number;
    avgScore: number | null;
    topicsAttempted: number;
    totalTopics: number;
  };
  perTopic: TopicProgressView[];
  weakAreas: TopicProgressView[];
  dueForReview: TopicProgressView[];
}

export async function getProgressSummary(): Promise<ProgressSummary> {
  const [topics, progress, attemptAgg] = await Promise.all([
    prisma.topic.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] }),
    prisma.topicProgress.findMany(),
    prisma.attempt.aggregate({ _count: true, _avg: { score: true } }),
  ]);

  const bySlug = new Map(progress.map((p) => [p.topicSlug, p]));
  const now = Date.now();

  const perTopic: TopicProgressView[] = topics.map((t) => {
    const p = bySlug.get(t.slug);
    return {
      slug: t.slug,
      name: t.name,
      tier: t.tier,
      difficulty: t.difficulty,
      attempts: p?.attempts ?? 0,
      avgScore: p ? Math.round(p.avgScore) : null,
      lastSeen: p?.lastSeen ?? null,
      nextDue: p?.nextDue ?? null,
      due: p?.nextDue ? new Date(p.nextDue).getTime() <= now : false,
    };
  });

  const attempted = perTopic.filter((t) => t.attempts > 0);
  const weakAreas = attempted
    .filter((t) => (t.avgScore ?? 100) < 70)
    .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0));
  const dueForReview = attempted
    .filter((t) => t.due)
    .sort((a, b) => new Date(a.nextDue!).getTime() - new Date(b.nextDue!).getTime());

  return {
    overall: {
      totalAttempts: attemptAgg._count,
      avgScore: attemptAgg._avg.score != null ? Math.round(attemptAgg._avg.score) : null,
      topicsAttempted: attempted.length,
      totalTopics: topics.length,
    },
    perTopic,
    weakAreas,
    dueForReview,
  };
}
