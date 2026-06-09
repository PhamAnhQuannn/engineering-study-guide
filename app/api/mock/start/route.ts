import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuestionType, parseChoices, type QuestionTypeKey } from "@/lib/questionTypes";
import { parseRubric } from "@/lib/rubric";
import { templateById, slotsForConfig } from "@/lib/mock";

// Offline: build an ordered mock question set from a template or custom config.
// No AI. Prefers unseen questions, avoids repeats within the run.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, config } = body ?? {};

    let slots: QuestionTypeKey[] = [];
    let perQuestionSec = 300;
    let tiers: number[] | undefined;

    if (typeof templateId === "string") {
      const t = templateById(templateId);
      if (!t) return NextResponse.json({ error: `Unknown template: ${templateId}` }, { status: 400 });
      slots = t.slots;
      perQuestionSec = t.perQuestionSec;
    } else if (config && Array.isArray(config.types)) {
      const types = config.types.filter((x: unknown): x is QuestionTypeKey => typeof x === "string" && isQuestionType(x));
      const count = Number(config.count) || 0;
      slots = slotsForConfig(types, count);
      perQuestionSec = Number(config.perQuestionSec) || 300;
      if (Array.isArray(config.tiers) && config.tiers.length) {
        tiers = config.tiers.map(Number).filter((n: number) => Number.isFinite(n));
      }
    } else {
      return NextResponse.json({ error: "templateId or config required." }, { status: 400 });
    }

    if (slots.length === 0) {
      return NextResponse.json({ error: "No question slots requested." }, { status: 400 });
    }

    const neededTypes = [...new Set(slots)];
    const where: { source: "docs"; type: { in: string[] }; topic?: { tier: { in: number[] } } } = {
      source: "docs",
      type: { in: neededTypes },
    };
    if (tiers && tiers.length) where.topic = { tier: { in: tiers } };

    const pool = await prisma.question.findMany({ where, include: { topic: true } });

    const used = new Set<string>();
    const items: unknown[] = [];
    const missing: QuestionTypeKey[] = [];

    for (const type of slots) {
      const candidates = pool.filter((q) => q.type === type && !used.has(q.id));
      if (candidates.length === 0) {
        missing.push(type);
        continue;
      }
      const unseen = candidates.filter((q) => !q.seen);
      const fromPool = unseen.length ? unseen : candidates;
      const q = fromPool[Math.floor(Math.random() * fromPool.length)];
      used.add(q.id);
      if (!q.seen) {
        await prisma.question.update({ where: { id: q.id }, data: { seen: true } });
      }
      items.push({
        id: q.id,
        prompt: q.prompt,
        choices: parseChoices(q.choices),
        type: q.type,
        referenceAnswer: q.referenceAnswer,
        rubric: parseRubric(q.rubric),
        topic: { slug: q.topic.slug, name: q.topic.name },
      });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No questions match this configuration. Loosen the filters." },
        { status: 422 }
      );
    }

    return NextResponse.json({ perQuestionSec, items, shortfall: missing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build mock.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
