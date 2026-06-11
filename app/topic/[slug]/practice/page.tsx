import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isQuestionType, type QuestionTypeKey } from "@/lib/questionTypes";
import { TopicSidebar } from "@/components/TopicSidebar";
import { PracticeRunner } from "@/components/PracticeRunner";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/topic/[slug]/practice">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) return {};
  return {
    title: `Practice ${topic.name} — Senior Backend Interview Prep`,
    description: `Drill ${topic.name} with spaced-repetition practice questions.`,
  };
}

export default async function TopicPracticePage(props: PageProps<"/topic/[slug]/practice">) {
  const { slug } = await props.params;
  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) notFound();

  const grouped = await prisma.question.groupBy({
    by: ["type"],
    where: { topicId: topic.id, source: "docs" },
    _count: { _all: true },
  });
  const availableTypes: { type: QuestionTypeKey; count: number }[] = grouped
    .filter((g) => isQuestionType(g.type))
    .map((g) => ({ type: g.type as QuestionTypeKey, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
      <aside className="hidden lg:block">
        <TopicSidebar />
      </aside>

      <div className="min-w-0 flex flex-col gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted">
            <Link href="/practice" className="hover:text-foreground">Practice</Link> / {topic.name}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{topic.name}</h1>
          <Link href={`/topic/${slug}/study`} className="text-sm text-accent hover:underline">
            Read the knowledge article →
          </Link>
        </div>

        {availableTypes.length === 0 ? (
          <p className="text-muted">No practice questions in the bank for this topic yet.</p>
        ) : (
          <PracticeRunner slug={slug} availableTypes={availableTypes} />
        )}
      </div>
    </div>
  );
}
