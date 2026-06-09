import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPrismaClient } from "../lib/prisma";
import { parseCategory, categoryKeyFromFolder } from "../lib/docsParse";
import { serializeRubric } from "../lib/rubric";

const prisma = createPrismaClient();

interface ManifestCategory {
  label: string;
  folder: string;
  path: string;
}
interface ManifestTopic {
  slug: string;
  categories: ManifestCategory[];
}
interface ManifestTier {
  topics: ManifestTopic[];
}

async function main() {
  const manifestPath = join(process.cwd(), "docs", ".manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestTier[];

  // Clear stale docs questions that were never attempted, so re-imports stay clean.
  // Attempted questions are kept (their extId upserts in place below).
  const cleared = await prisma.question.deleteMany({
    where: { source: "docs", attempts: { none: {} } },
  });
  if (cleared.count) console.log(`Cleared ${cleared.count} un-attempted docs questions.`);

  let questionCount = 0;
  let studyNoteCount = 0;
  const byType: Record<string, number> = {};

  for (const tier of manifest) {
    for (const topic of tier.topics) {
      const dbTopic = await prisma.topic.findUnique({ where: { slug: topic.slug } });
      if (!dbTopic) {
        console.warn(`! No DB topic for slug ${topic.slug}, skipping.`);
        continue;
      }

      for (const cat of topic.categories) {
        const text = readFileSync(join(process.cwd(), cat.path), "utf8");
        const key = categoryKeyFromFolder(cat.folder);

        // knowledge -> Study note (not Q&A)
        if (!key) {
          if (cat.folder.endsWith("knowledge")) {
            await prisma.studyNote.upsert({
              where: { topicSlug: topic.slug },
              update: { markdown: text },
              create: { topicSlug: topic.slug, markdown: text },
            });
            studyNoteCount++;
          }
          continue;
        }

        const parsed = parseCategory(cat.folder, text);
        for (let i = 0; i < parsed.length; i++) {
          const q = parsed[i];
          const extId = `${topic.slug}:${key}:${i + 1}`;
          await prisma.question.upsert({
            where: { extId },
            update: {
              type: q.type,
              difficulty: dbTopic.difficulty,
              prompt: q.prompt,
              choices: q.choices ? JSON.stringify(q.choices) : null,
              referenceAnswer: q.referenceAnswer,
              rubric: serializeRubric(q.checklist),
              source: "docs",
            },
            create: {
              extId,
              topicId: dbTopic.id,
              type: q.type,
              difficulty: dbTopic.difficulty,
              prompt: q.prompt,
              choices: q.choices ? JSON.stringify(q.choices) : null,
              referenceAnswer: q.referenceAnswer,
              rubric: serializeRubric(q.checklist),
              source: "docs",
            },
          });
          questionCount++;
          byType[q.type] = (byType[q.type] ?? 0) + 1;
        }
      }
    }
  }

  console.log(`Imported ${questionCount} questions, ${studyNoteCount} study notes.`);
  console.log("By type:", byType);
  const dbTotal = await prisma.question.count({ where: { source: "docs" } });
  console.log(`Total docs questions in DB: ${dbTotal}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
