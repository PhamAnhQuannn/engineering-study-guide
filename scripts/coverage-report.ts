import "dotenv/config";
import { createPrismaClient } from "../lib/prisma";

// Coverage gauge (issue 004): per topic — notes present?, questions per type,
// and % of questions that have a non-empty checklist (rubric). Drives the
// continuous checklist retrofit (issue 008). Read-only.

function hasRubric(rubric: string): boolean {
  try {
    const v = JSON.parse(rubric);
    return Array.isArray(v) && v.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  const prisma = createPrismaClient();
  try {
    const [topics, questions, notes] = await Promise.all([
      prisma.topic.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] }),
      prisma.question.findMany({ select: { topicId: true, type: true, rubric: true } }),
      prisma.studyNote.findMany({ select: { topicSlug: true } }),
    ]);

    const noteSlugs = new Set(notes.map((n) => n.topicSlug));
    const byTopic = new Map<string, { total: number; withRubric: number; types: Record<string, number> }>();
    for (const q of questions) {
      const e = byTopic.get(q.topicId) ?? { total: 0, withRubric: 0, types: {} };
      e.total++;
      if (hasRubric(q.rubric)) e.withRubric++;
      e.types[q.type] = (e.types[q.type] ?? 0) + 1;
      byTopic.set(q.topicId, e);
    }

    let totalQ = 0;
    let totalRubric = 0;
    let topicsNoNotes = 0;
    let topicsNoQuestions = 0;

    console.log("Coverage report\n===============");
    for (const t of topics) {
      const e = byTopic.get(t.id) ?? { total: 0, withRubric: 0, types: {} };
      totalQ += e.total;
      totalRubric += e.withRubric;
      if (!noteSlugs.has(t.slug)) topicsNoNotes++;
      if (e.total === 0) topicsNoQuestions++;

      const notesMark = noteSlugs.has(t.slug) ? "notes ✓" : "notes ✗";
      const rubricPct = e.total ? Math.round((e.withRubric / e.total) * 100) : 0;
      const typeStr = Object.entries(e.types)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");
      const flag = e.total === 0 || !noteSlugs.has(t.slug) || rubricPct < 100 ? " ⚑" : "";
      console.log(
        `T${t.tier} ${t.slug.padEnd(24)} ${notesMark}  Q=${String(e.total).padStart(3)}  checklist=${String(rubricPct).padStart(3)}%  [${typeStr}]${flag}`
      );
    }

    const overallPct = totalQ ? Math.round((totalRubric / totalQ) * 100) : 0;
    console.log("\nTotals");
    console.log(`  topics: ${topics.length}`);
    console.log(`  topics missing notes: ${topicsNoNotes}`);
    console.log(`  topics with no questions: ${topicsNoQuestions}`);
    console.log(`  questions: ${totalQ}`);
    console.log(`  with checklist: ${totalRubric} (${overallPct}%)`);
    console.log(`  ⚑ = below target (no notes / no questions / checklist < 100%)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
