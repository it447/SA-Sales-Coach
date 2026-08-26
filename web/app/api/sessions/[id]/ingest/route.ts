import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";
import { runExtraction } from "../../../../../lib/extraction";
import { runQuote } from "../../../../../lib/quoting";
import type { TranscriptChunk } from "../../../../../lib/types";

/**
 * POST /api/sessions/:id/ingest — the extension's live-call loop calls this
 * instead of separately hitting /transcript, /extract, then /quote. Same
 * three steps (append transcript, extract scope, price it), but as one
 * request instead of three round trips — this loop fires every couple of
 * seconds for the length of a call, so each extra round trip is latency
 * the rep feels directly. /transcript, /extract, and /quote stay as their
 * own routes for the /test console and any manual re-run.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: { chunks?: TranscriptChunk[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.chunks) || body.chunks.length === 0) {
    return NextResponse.json({ error: "chunks (non-empty array) is required." }, { status: 400 });
  }

  try {
    const appendResult = await pool.query(
      "update call_sessions set transcript = transcript || $1::jsonb where id = $2 returning *",
      [JSON.stringify(body.chunks), params.id]
    );
    if (appendResult.rows.length === 0) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const sessionAfterAppend = rowToSession(appendResult.rows[0]);
    const { session: sessionAfterExtraction, objectionSuggestions } = await runExtraction(sessionAfterAppend);

    const finalSession = sessionAfterExtraction.quote.lockedAt
      ? sessionAfterExtraction
      : await runQuote(sessionAfterExtraction);

    return NextResponse.json({ session: finalSession, objectionSuggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
