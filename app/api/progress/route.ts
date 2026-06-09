import { NextResponse } from "next/server";
import { getProgressSummary } from "@/lib/progress";

export async function GET() {
  try {
    const summary = await getProgressSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load progress.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
