import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isQuestionType, type QuestionTypeKey } from "@/lib/questionTypes";
import { TIERS } from "@/lib/taxonomy";
import { TopicStarter } from "@/components/TopicStarter";

export const dynamic = "force-dynamic";

export default async function TopicPage(props: PageProps<"/topic/[slug]">) {
  const { slug } = await props.params;
  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) notFound();

  // Types that actually have bank questions for this topic.
  const grouped = await prisma.question.groupBy({
    by: ["type"],
    where: { topicId: topic.id, source: "docs" },
    _count: { _all: true },
  });
  const availableTypes: { type: QuestionTypeKey; count: number }[] = grouped
    .filter((g) => isQuestionType(g.type))
    .map((g) => ({ type: g.type as QuestionTypeKey, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const note = await prisma.studyNote.findUnique({
    where: { topicSlug: slug },
    select: { topicSlug: true },
  });

  const tier = TIERS.find((t) => t.tier === topic.tier);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-xs opacity-50">
          T{topic.tier} · {tier?.name}
        </div>
        <h1 className="text-2xl font-bold mt-1">{topic.name}</h1>
        <p className="opacity-70 mt-1">{topic.description}</p>
        {note && (
          <Link
            href={`/topic/${slug}/study`}
            className="inline-block mt-3 rounded-md border border-border px-4 py-2 text-sm hover:border-accent/50"
          >
            📖 Study notes
          </Link>
        )}
      </div>

      {availableTypes.length === 0 ? (
        <p className="opacity-60">No practice questions in the bank for this topic yet.</p>
      ) : (
        <TopicStarter slug={slug} availableTypes={availableTypes} />
      )}
    </div>
  );
}
