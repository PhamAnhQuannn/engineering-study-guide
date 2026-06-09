import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
import { TopicSidebar } from "@/components/TopicSidebar";
import { TOPICS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Build a table of contents from the H2 headings in the markdown.
function buildToc(markdown: string): { text: string; slug: string }[] {
  return markdown
    .split(/\r?\n/)
    .filter((l) => /^##\s+/.test(l))
    .map((l) => {
      const text = l.replace(/^##\s+/, "").trim();
      return { text, slug: slugify(text) };
    });
}

export default async function StudyPage(props: PageProps<"/topic/[slug]/study">) {
  const { slug } = await props.params;
  const [topic, note] = await Promise.all([
    prisma.topic.findUnique({ where: { slug } }),
    prisma.studyNote.findUnique({ where: { topicSlug: slug } }),
  ]);
  if (!topic) notFound();

  const toc = note ? buildToc(note.markdown) : [];
  const idx = TOPICS.findIndex((t) => t.slug === slug);
  const prev = idx > 0 ? TOPICS[idx - 1] : null;
  const next = idx >= 0 && idx < TOPICS.length - 1 ? TOPICS[idx + 1] : null;

  return (
    <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)_160px] lg:gap-6">
      <aside className="hidden lg:block">
        <TopicSidebar />
      </aside>

      <article className="min-w-0">
        <div className="font-mono text-xs uppercase tracking-wider text-muted">
          <Link href="/" className="hover:text-foreground">
            Topics
          </Link>{" "}
          / {topic.name}
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{topic.name}</h1>
        <p className="text-muted mt-1">{topic.description}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/topic/${slug}`}
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Practice this topic →
          </Link>
        </div>

        <hr className="my-6 border-border" />

        {note ? (
          <Markdown>{note.markdown}</Markdown>
        ) : (
          <p className="text-muted">No study notes for this topic yet.</p>
        )}

        <hr className="my-6 border-border" />
        <div className="flex justify-between gap-4 text-sm">
          {prev ? (
            <Link href={`/topic/${prev.slug}/study`} className="text-muted hover:text-foreground">
              ← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/topic/${next.slug}/study`} className="text-muted hover:text-foreground text-right">
              {next.name} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </article>

      {toc.length > 0 && (
        <aside className="hidden lg:block">
          <div className="sticky top-16 text-sm">
            <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted mb-2">
              On this page
            </div>
            <ul className="flex flex-col gap-1 border-l border-border">
              {toc.map((h) => (
                <li key={h.slug}>
                  <a
                    href={`#${h.slug}`}
                    className="block -ml-px border-l border-transparent pl-3 text-muted hover:text-accent hover:border-accent transition-colors"
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
