import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/Markdown";

export const dynamic = "force-dynamic";

export default async function StudyPage(props: PageProps<"/topic/[slug]/study">) {
  const { slug } = await props.params;
  const [topic, note] = await Promise.all([
    prisma.topic.findUnique({ where: { slug } }),
    prisma.studyNote.findUnique({ where: { topicSlug: slug } }),
  ]);
  if (!topic) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/topic/${slug}`} className="opacity-60 hover:opacity-100">
          ← {topic.name}
        </Link>
        <span className="opacity-50">Study notes</span>
      </div>

      {note ? (
        <article className="rounded-md border border-border bg-surface p-5">
          <Markdown>{note.markdown}</Markdown>
        </article>
      ) : (
        <p className="opacity-60">No study notes for this topic yet.</p>
      )}

      <Link
        href={`/topic/${slug}`}
        className="self-start rounded-md bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:opacity-90"
      >
        Practice this topic →
      </Link>
    </div>
  );
}
