import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readFileSync } from "fs";
import { join } from "path";
import { TOPICS, SYSTEM_SLUGS } from "@/lib/taxonomy";
import { Markdown } from "@/components/Markdown";
import { Toc, type TocItem } from "@/components/Toc";

export const dynamic = "force-dynamic";

interface ManifestCategory {
  label: string;
  folder: string;
  path: string;
}
interface ManifestTopic {
  slug: string;
  name: string;
  categories: ManifestCategory[];
}
interface ManifestTier {
  topics: ManifestTopic[];
}

function loadManifest(): ManifestTier[] {
  const raw = readFileSync(join(process.cwd(), "docs/.manifest.json"), "utf-8");
  return JSON.parse(raw);
}

function findTopic(slug: string): ManifestTopic | undefined {
  for (const tier of loadManifest()) {
    const t = tier.topics.find((t: ManifestTopic) => t.slug === slug);
    if (t) return t;
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

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

const SECTION_LABELS = [
  "Knowledge & Concepts",
  "System Design",
  "Capacity Estimation",
  "Decisions & Tradeoffs",
];

export async function generateMetadata(
  props: PageProps<"/systems/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) return {};
  return {
    title: `${topic.name} — Full Build — Senior Backend Interview Prep`,
    description: topic.description,
  };
}

export default async function SystemStoryPage(
  props: PageProps<"/systems/[slug]">,
) {
  const { slug } = await props.params;

  if (!SYSTEM_SLUGS.includes(slug as (typeof SYSTEM_SLUGS)[number])) {
    notFound();
  }

  const topic = TOPICS.find((t) => t.slug === slug)!;
  const manifest = findTopic(slug);
  if (!manifest) notFound();

  const sections = manifest.categories.map((cat, i) => {
    const filePath = join(process.cwd(), cat.path);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      content = `*Content not yet available for ${cat.label}.*`;
    }
    return { label: SECTION_LABELS[i] ?? cat.label, content };
  });

  const combined = sections
    .map((s) => s.content)
    .join("\n\n---\n\n");

  const toc = buildToc(combined);

  const idx = SYSTEM_SLUGS.indexOf(slug as (typeof SYSTEM_SLUGS)[number]);
  const prevSlug = idx > 0 ? SYSTEM_SLUGS[idx - 1] : null;
  const nextSlug = idx < SYSTEM_SLUGS.length - 1 ? SYSTEM_SLUGS[idx + 1] : null;
  const prevTopic = prevSlug ? TOPICS.find((t) => t.slug === prevSlug) : null;
  const nextTopic = nextSlug ? TOPICS.find((t) => t.slug === nextSlug) : null;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-6">
      <article className="min-w-0">
        <div className="font-mono text-xs uppercase tracking-wider text-muted">
          <Link href="/systems" className="hover:text-foreground">
            Systems
          </Link>{" "}
          / {topic.name}
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {topic.name}
        </h1>
        <p className="text-muted mt-1">{topic.description}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/topic/${slug}/practice`}
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Practice this topic →
          </Link>
          <Link
            href={`/topic/${slug}/study`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            Study notes
          </Link>
        </div>

        <Toc items={toc} variant="mobile" />

        <hr className="my-8 border-border" />

        <Markdown>{combined}</Markdown>

        <hr className="my-8 border-border" />
        <nav
          className="grid grid-cols-2 gap-4"
          aria-label="Previous and next systems"
        >
          {prevTopic ? (
            <Link
              href={`/systems/${prevTopic.slug}`}
              className="group flex flex-col gap-1 rounded-lg border border-border p-4 hover:bg-surface transition-colors"
            >
              <span className="text-xs text-muted">← Previous</span>
              <span className="font-medium group-hover:text-accent transition-colors">
                {prevTopic.name}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {nextTopic ? (
            <Link
              href={`/systems/${nextTopic.slug}`}
              className="group flex flex-col gap-1 rounded-lg border border-border p-4 text-right hover:bg-surface transition-colors"
            >
              <span className="text-xs text-muted">Next →</span>
              <span className="font-medium group-hover:text-accent transition-colors">
                {nextTopic.name}
              </span>
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
