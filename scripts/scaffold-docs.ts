import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TIERS, TOPICS } from "../lib/taxonomy";
import type { QuestionTypeKey } from "../lib/questionTypes";

// ---- category derivation ----

interface CategoryRule {
  folder: string;
  label: string;
  always?: boolean;
  types?: QuestionTypeKey[];
}

const CATEGORY_RULES: CategoryRule[] = [
  { folder: "knowledge", label: "Knowledge / Study Notes", always: true },
  { folder: "practice-questions", label: "Practice Questions", types: ["KNOWLEDGE", "EXPLAIN", "QUIZ"] },
  { folder: "coding-problems", label: "Coding Problems", types: ["CODING", "DEBUG"] },
  { folder: "design-questions", label: "System Design Questions", types: ["SYSTEM_DESIGN"] },
  { folder: "estimation-questions", label: "Estimation Questions", types: ["ESTIMATION"] },
  { folder: "decision-questions", label: "Decision & Tradeoff Questions", types: ["DECISION"] },
  { folder: "real-situations", label: "Real-World Situations", types: ["SCENARIO"] },
  { folder: "behavioral-questions", label: "Behavioral (STAR) Questions", types: ["BEHAVIORAL"] },
];

function categoriesFor(supportedTypes: QuestionTypeKey[]): CategoryRule[] {
  return CATEGORY_RULES.filter(
    (r) => r.always || r.types?.some((t) => supportedTypes.includes(t))
  );
}

// ---- helpers ----

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const DOCS = join(process.cwd(), "docs");

interface CategoryEntry {
  label: string;
  folder: string;
  path: string; // relative to repo root, posix-ish for readability
}
interface TopicEntry {
  name: string;
  slug: string;
  description: string;
  supportedTypes: QuestionTypeKey[];
  dir: string;
  categories: CategoryEntry[];
}
interface TierEntry {
  tier: number;
  name: string;
  blurb: string;
  dir: string;
  topics: TopicEntry[];
}

const manifest: TierEntry[] = [];

// ---- build tree ----

mkdirSync(DOCS, { recursive: true });

for (const tier of TIERS) {
  const tierFolder = `${pad2(tier.tier)}-${slugify(tier.name)}`;
  const tierDir = join(DOCS, tierFolder);
  mkdirSync(tierDir, { recursive: true });

  const tierTopics = TOPICS.filter((t) => t.tier === tier.tier);
  const tierEntry: TierEntry = {
    tier: tier.tier,
    name: tier.name,
    blurb: tier.blurb,
    dir: `docs/${tierFolder}`,
    topics: [],
  };

  tierTopics.forEach((topic, i) => {
    const topicFolder = `${pad2(i + 1)}-${topic.slug}`;
    const topicDir = join(tierDir, topicFolder);
    mkdirSync(topicDir, { recursive: true });

    const cats = categoriesFor(topic.supportedTypes);
    const catEntries: CategoryEntry[] = [];

    cats.forEach((cat, j) => {
      const catFolder = `${pad2(j + 1)}-${cat.folder}`;
      const catDir = join(topicDir, catFolder);
      mkdirSync(catDir, { recursive: true });

      const catReadme = join(catDir, "README.md");
      // Only write placeholder if no content exists yet (safe re-run).
      if (!existsSync(catReadme)) {
        writeFileSync(
          catReadme,
          `# ${topic.name} — ${cat.label}\n\n> Topic: ${topic.description}\n\n<!-- TODO:fill -->\n`
        );
      }

      catEntries.push({
        label: cat.label,
        folder: catFolder,
        path: `docs/${tierFolder}/${topicFolder}/${catFolder}/README.md`,
      });
    });

    // Topic overview index.
    const topicReadme =
      `# ${topic.name}\n\n` +
      `${topic.description}\n\n` +
      `**Tier ${tier.tier} — ${tier.name}** · Difficulty: ${topic.difficulty}\n\n` +
      `## Sections\n\n` +
      catEntries.map((c) => `- [${c.label}](./${c.folder}/README.md)`).join("\n") +
      `\n\n[← Back to ${tier.name}](../README.md)\n`;
    writeFileSync(join(topicDir, "README.md"), topicReadme);

    tierEntry.topics.push({
      name: topic.name,
      slug: topic.slug,
      description: topic.description,
      supportedTypes: topic.supportedTypes,
      dir: `docs/${tierFolder}/${topicFolder}`,
      categories: catEntries,
    });
  });

  // Tier overview index.
  const tierReadme =
    `# Tier ${tier.tier} — ${tier.name}\n\n` +
    `${tier.blurb}\n\n` +
    `## Topics\n\n` +
    tierEntry.topics
      .map((t, i) => `${i + 1}. [${t.name}](./${pad2(i + 1)}-${t.slug}/README.md) — ${t.description}`)
      .join("\n") +
    `\n\n[← Back to all topics](../README.md)\n`;
  writeFileSync(join(tierDir, "README.md"), tierReadme);

  manifest.push(tierEntry);
}

// ---- master index ----

const masterReadme =
  `# Senior Backend Interview Prep — Knowledge Base\n\n` +
  `Comprehensive study notes and practice questions across every topic, ` +
  `from fundamentals to product sense. Folders are numbered to suggest a reading order, ` +
  `but jump to whatever you need.\n\n` +
  `Each topic has a **knowledge** section (study notes) plus practice sections ` +
  `(coding, design, decision, real-world situations, behavioral, estimation) depending on the topic.\n\n` +
  `## Tiers\n\n` +
  manifest
    .map((t) => `${t.tier}. [${t.name}](./${pad2(t.tier)}-${slugify(t.name)}/README.md) — ${t.blurb}`)
    .join("\n") +
  `\n`;
writeFileSync(join(DOCS, "README.md"), masterReadme);

// ---- manifest for the authoring step ----

writeFileSync(join(DOCS, ".manifest.json"), JSON.stringify(manifest, null, 2));

// ---- summary ----

const topicCount = manifest.reduce((a, t) => a + t.topics.length, 0);
const catCount = manifest.reduce(
  (a, t) => a + t.topics.reduce((b, top) => b + top.categories.length, 0),
  0
);
console.log(
  `Scaffolded docs/: ${manifest.length} tiers, ${topicCount} topics, ${catCount} category files.`
);
console.log(`Index READMEs: 1 master + ${manifest.length} tiers + ${topicCount} topics.`);
console.log(`Manifest written to docs/.manifest.json`);
