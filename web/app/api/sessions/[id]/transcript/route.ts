import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession } from "../../../../../lib/sessions";
import type { TranscriptChunk } from "../../../../../lib/types";

/**
 * POST /api/sessions/:id/transcript — the extension posts new caption
 * chunks here as the call happens (batched every ~5s, not every word).
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
    const result = await pool.query(
      "update call_sessions set transcript = transcript || $1::jsonb where id = $2 returning *",
      [JSON.stringify(body.chunks), params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
