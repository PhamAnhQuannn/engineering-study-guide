import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Markdown } from "@/components/Markdown";
import { Toc, type TocItem } from "@/components/Toc";
import { TOPICS, TIERS, orderIndex } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/topic/[slug]/study">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const topic = await prisma.topic.findUnique({ where: { slug } });
  if (!topic) return {};
  const tier = TIERS.find((t) => t.tier === topic.tier);
  return {
    title: `${topic.name} — Senior Backend Interview Prep`,
    description: topic.description,
    openGraph: {
      title: `${topic.name} — Study Guide`,
      description: topic.description,
      type: "article",
      section: tier?.name,
    },
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Build a table of contents from the H2/H3 headings in the markdown.
function buildToc(markdown: string): TocItem[] {
  return markdown
    .split(/\r?\n/)
    .filter((l) => /^###?\s+/.test(l))
    .map((l) => {
      const level: 2 | 3 = l.startsWith("### ") ? 3 : 2;
      const text = l.replace(/^#{2,3}\s+/, "").trim();
      return { text, slug: slugify(text), level };
    });
}

export default async function StudyPage(props: PageProps<"/topic/[slug]/study">) {
  const { slug } = await props.params;
  const [topic, note, progress] = await Promise.all([
    prisma.topic.findUnique({ where: { slug } }),
    prisma.studyNote.findUnique({ where: { topicSlug: slug } }),
    prisma.topicProgress.findUnique({ where: { topicSlug: slug } }),
  ]);
  if (!topic) notFound();

  const due = progress?.nextDue ? new Date(progress.nextDue).getTime() <= Date.now() : false;
  const toc = note ? buildToc(note.markdown) : [];
  // prev/next follow the canonical learning order, not the raw TOPICS array.
  const ordered = [...TOPICS].sort((a, b) => orderIndex(a.slug) - orderIndex(b.slug));
  const idx = ordered.findIndex((t) => t.slug === slug);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const tier = TIERS.find((t) => t.tier === topic.tier);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    name: topic.name,
    description: topic.description,
    articleSection: tier?.name,
    isPartOf: {
      "@type": "WebSite",
      name: "Senior Backend Interview Prep",
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Knowledge", item: "/knowledge" },
      { "@type": "ListItem", position: 2, name: topic.name },
    ],
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

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
            href={`/topic/${slug}/practice`}
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Practice this topic →
          </Link>
        </div>

        {due && (
          <Link
            href={`/topic/${slug}/practice`}
            className="mt-4 flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm hover:bg-accent/20 transition-colors"
          >
            <span>⏰</span>
            <span>
              <strong>Due for review.</strong> You last studied this{" "}
              {progress?.lastSeen ? new Date(progress.lastSeen).toLocaleDateString() : "a while ago"}. Drill it now →
            </span>
          </Link>
        )}

        {/* Mobile in-page nav (desktop version sits in the right column) */}
        <Toc items={toc} variant="mobile" />

        <hr className="my-8 border-border" />

        {note ? (
          <Markdown>{note.markdown}</Markdown>
        ) : (
          <p className="text-muted">No study notes for this topic yet.</p>
        )}

        <hr className="my-8 border-border" />
        <nav className="grid grid-cols-2 gap-4" aria-label="Previous and next topics">
          {prev ? (
            <Link
              href={`/topic/${prev.slug}/study`}
              className="group flex flex-col gap-1 rounded-lg border border-border p-4 hover:bg-surface transition-colors"
            >
              <span className="text-xs text-muted">← Previous</span>
              <span className="font-medium group-hover:text-accent transition-colors">{prev.name}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/topic/${next.slug}/study`}
              className="group flex flex-col gap-1 rounded-lg border border-border p-4 text-right hover:bg-surface transition-colors"
            >
              <span className="text-xs text-muted">Next →</span>
              <span className="font-medium group-hover:text-accent transition-colors">{next.name}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>

      {toc.length > 0 && (
        <aside className="hidden lg:block">
          <Toc items={toc} variant="desktop" />
        </aside>
      )}
    </div>
  );
}
