import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQuestionType, parseChoices } from "@/lib/questionTypes";
import { parseRubric } from "@/lib/rubric";

// Offline: pick a question from the imported docs bank. No AI.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topicSlug, type } = body ?? {};

    if (typeof topicSlug !== "string" || typeof type !== "string") {
      return NextResponse.json({ error: "topicSlug and type are required." }, { status: 400 });
    }
    if (!isQuestionType(type)) {
      return NextResponse.json({ error: `Unknown question type: ${type}` }, { status: 400 });
    }

    const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } });
    if (!topic) {
      return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    }

    const where = { topicId: topic.id, type, source: "docs" as const };

    // Prefer a never-served question; otherwise recycle the whole pool at random.
    const unseen = await prisma.question.count({ where: { ...where, seen: false } });
    const pool = unseen > 0 ? { ...where, seen: false } : where;
    const total = unseen > 0 ? unseen : await prisma.question.count({ where });

    if (total === 0) {
      return NextResponse.json(
        { error: "No questions in the bank for this topic and type yet." },
        { status: 404 }
      );
    }

    const skip = Math.floor(Math.random() * total);
    const q = await prisma.question.findFirst({ where: pool, skip, orderBy: { id: "asc" } });
    if (!q) {
      return NextResponse.json({ error: "Could not pick a question." }, { status: 500 });
    }

    if (!q.seen) {
      await prisma.question.update({ where: { id: q.id }, data: { seen: true } });
    }

    // Local single-user app: returning the model answer for client-side reveal is fine.
    return NextResponse.json({
      id: q.id,
      prompt: q.prompt,
      choices: parseChoices(q.choices),
      type: q.type,
      referenceAnswer: q.referenceAnswer,
      rubric: parseRubric(q.rubric),
      topic: { slug: topic.slug, name: topic.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
