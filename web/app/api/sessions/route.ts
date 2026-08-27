import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../lib/auth";
import { pool } from "../../../lib/db";
import { rowToSession } from "../../../lib/sessions";

/** POST /api/sessions — creates a new call session when a rep starts a call. */
export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: { meetLink?: string; repEmail?: string; meetingName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.meetLink || !body.repEmail) {
    return NextResponse.json({ error: "meetLink and repEmail are required." }, { status: 400 });
  }

  try {
    const result = await pool.query(
      "insert into call_sessions (meet_link, rep_email, meeting_name) values ($1, $2, $3) returning *",
      [body.meetLink, body.repEmail, body.meetingName ?? null]
    );
    return NextResponse.json(rowToSession(result.rows[0]), { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
