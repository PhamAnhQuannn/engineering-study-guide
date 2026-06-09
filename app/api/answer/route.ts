import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRating, scoreForRating, nextDueForRating, updateAvg } from "@/lib/spacedRepetition";

// Offline self-rating: record an attempt and advance spaced repetition. No AI.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questionId, rating } = body ?? {};

    if (typeof questionId !== "string") {
      return NextResponse.json({ error: "questionId is required." }, { status: 400 });
    }
    if (!isRating(rating)) {
      return NextResponse.json({ error: "rating must be again | good | easy." }, { status: 400 });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { topic: true },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const score = scoreForRating(rating);
    await prisma.attempt.create({
      data: {
        questionId: question.id,
        userAnswer: "",
        score,
        feedback: JSON.stringify({ rating }),
      },
    });

    const slug = question.topic.slug;
    const now = new Date();
    const existing = await prisma.topicProgress.findUnique({ where: { topicSlug: slug } });
    if (existing) {
      await prisma.topicProgress.update({
        where: { topicSlug: slug },
        data: {
          attempts: existing.attempts + 1,
          avgScore: updateAvg(existing.avgScore, existing.attempts, score),
          lastSeen: now,
          nextDue: nextDueForRating(rating, now),
        },
      });
    } else {
      await prisma.topicProgress.create({
        data: {
          topicSlug: slug,
          attempts: 1,
          avgScore: score,
          lastSeen: now,
          nextDue: nextDueForRating(rating, now),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record answer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
