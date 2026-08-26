import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { getSession } from "../../../../../lib/sessions";
import { runExtraction } from "../../../../../lib/extraction";

/**
 * POST /api/sessions/:id/extract — runs after new transcript chunks come
 * in. Calls Claude to update role scope, detect flags, and surface
 * objection-handling suggestions. Kept as its own route for the /test
 * console and any manual re-run; the extension's live-call loop uses the
 * combined /ingest route instead to save a round trip.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (session.transcript.length === 0) {
    return NextResponse.json({ error: "No transcript to extract from yet." }, { status: 400 });
  }

  try {
    const outcome = await runExtraction(session);
    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
