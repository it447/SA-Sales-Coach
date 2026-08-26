import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { getSession } from "../../../../../lib/sessions";
import { runQuote } from "../../../../../lib/quoting";

/**
 * POST /api/sessions/:id/quote — runs the margin calculation against the
 * current roles. Kept as its own route for the /test console, the
 * sidebar's manual "Calculate Price" button, and any manual re-run; the
 * extension's live-call loop uses the combined /ingest route instead to
 * save a round trip. Does NOT set quote.lockedAt — that only happens when
 * the rep explicitly confirms via /lock-price.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  try {
    const updatedSession = await runQuote(session);
    return NextResponse.json(updatedSession);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
