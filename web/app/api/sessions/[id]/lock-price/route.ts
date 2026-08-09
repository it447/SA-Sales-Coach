import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { pool } from "../../../../../lib/db";
import { rowToSession, getSession } from "../../../../../lib/sessions";

/**
 * POST /api/sessions/:id/lock-price — rep-triggered. Sets quote.lockedAt
 * and status to "priced". This is the ONLY place lockedAt gets set — never
 * inferred automatically from /quote or from Claude.
 *
 * Optional body: { finalPrice?: number } to lock in a different number
 * than the last computed quote (e.g. the rep negotiated a different price
 * with the client than what /quote suggested).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const session = await getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let body: { finalPrice?: number } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const finalPrice = body.finalPrice ?? session.quote.finalPrice;
  if (finalPrice === null || finalPrice === undefined) {
    return NextResponse.json(
      { error: "No price to lock — run /quote first, or pass finalPrice explicitly." },
      { status: 400 }
    );
  }

  const newQuote = {
    ...session.quote,
    finalPrice,
    lockedAt: new Date().toISOString(),
  };

  try {
    const result = await pool.query(
      "update call_sessions set quote = $1::jsonb, status = 'priced' where id = $2 returning *",
      [JSON.stringify(newQuote), params.id]
    );
    return NextResponse.json(rowToSession(result.rows[0]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
