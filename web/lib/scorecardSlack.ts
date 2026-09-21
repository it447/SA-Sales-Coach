// Posts a finished scorecard to Slack via an Incoming Webhook. Ported from
// the standalone ScoreCardApp's lib/slack.ts.
//
// One webhook URL = one fixed channel, set when the webhook is created in
// the Slack app config (api.slack.com/apps -> your app -> Incoming
// Webhooks -> Add New Webhook to Workspace, choosing the destination
// channel there). SLACK_WEBHOOK_URL holds that URL.
//
// Best-effort by design: a missing or failing webhook must never break
// scoring. The caller (cleanup-transcript/route.ts) awaits this after the
// scorecard is already saved, wrapped in its own try/catch, and only logs
// on failure.

import type { ScorecardResult } from "./types";

// Email -> Slack member ID, so the rep gets a real @mention (and a
// notification ping) rather than just their name in plain text. An
// Incoming Webhook has no way to look a person up by email, so this has to
// be maintained by hand: set SLACK_USER_MAP as a comma-separated
// "email:memberId" list, e.g.
// SLACK_USER_MAP=dijah@scalearmy.com:U0123ABCD,seif@scalearmy.com:U0456EFGH
// A rep not listed here still appears by name, just without a real mention.
function slackUserId(email: string | null | undefined): string | null {
  if (!email) return null;
  const raw = process.env.SLACK_USER_MAP;
  if (!raw) return null;
  for (const pair of raw.split(",")) {
    const [emailPart, idPart] = pair.split(":");
    if (emailPart?.trim().toLowerCase() === email.trim().toLowerCase()) {
      return idPart?.trim() || null;
    }
  }
  return null;
}

function scoreBand(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return "🟢";
  if (pct >= 0.5) return "🟡";
  return "🔴";
}

function sqlEmoji(status: string): string {
  if (status === "Yes") return "✅";
  if (status === "Unclear") return "❓";
  return "❌";
}

export async function sendScorecardToSlack(opts: {
  scorecard: ScorecardResult;
  /** The rep's email — used to look up their Slack member ID for a real @mention. */
  repEmail: string | null;
  reportUrl: string;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // Slack not configured for this deployment -- skip silently

  const { scorecard: sc, repEmail, reportUrl } = opts;

  const slackId = slackUserId(repEmail);
  const repMention = slackId ? `<@${slackId}>` : `*${sc.rep_name || "Unknown rep"}*`;
  const meetingName = `${sc.rep_name || "Unknown rep"} → ${sc.client_name || "Unknown client"}`;

  const categoryLines = sc.categories
    .map((c) => `${scoreBand(c.score, c.max)} *${c.name}*: ${c.score}/${c.max}`)
    .join("\n");

  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: "📞 New call scorecard", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*${meetingName}*\nRep: ${repMention}` } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*SQL status*\n${sqlEmoji(sc.sql.status)} ${sc.sql.status}` },
        { type: "mrkdwn", text: `*Overall score*\n${sc.overall_score} / ${sc.max_score}` },
      ],
    },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: `*Category scores*\n${categoryLines}` } },
  ];

  if (sc.flags?.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `🚩 *Flags:* ${sc.flags.join("; ")}` } });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "View full report", emoji: true }, url: reportUrl, style: "primary" },
      ],
    }
  );

  const fallbackText = `${meetingName} — SQL ${sc.sql.status}, score ${sc.overall_score}/${sc.max_score}. ${reportUrl}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fallbackText, blocks }),
    });
    if (!res.ok) {
      console.error("Slack webhook failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("Slack webhook error:", e);
  }
}
