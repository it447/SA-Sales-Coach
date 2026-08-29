import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import path from "path";
import { USA_BENCHMARK_ROLES } from "./types";
import type { RoleScope, ScopeFlag, CallPhases, TranscriptChunk, CallSession } from "./types";

// Matches the model already in production use by the scale-army-jd-tool
// agent, for consistency across our internal tools. Used for JD generation
// and call recaps -- one-shot, quality-sensitive tasks where cost isn't
// dominated by call frequency.
const MODEL = "claude-sonnet-4-6";

// Extraction runs on every live-call tick (every ~8s of active speech, see
// TRANSCRIPT_BATCH_MS in the extension) -- a single 30-minute call can mean
// hundreds of calls, so its per-call cost matters far more than its
// per-call quality ceiling. Haiku is materially cheaper and this is a
// structured field-filling task (forced tool use against a fixed schema),
// not open-ended reasoning -- the accuracy trade is worth the ~3x cost cut
// (before caching) at this call volume.
const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function readConfigDoc(filename: string): string {
  return readFileSync(path.join(process.cwd(), "config", filename), "utf8");
}

export interface ExtractResult {
  roles: RoleScope[];
  scopeFlags: ScopeFlag[];
  callPhases: CallPhases;
  /**
   * Live objection-handling suggestions for whatever pushback (if any)
   * appears in the transcript so far. NOT persisted to the session record
   * (CallSession has no field for it) — this is a transient value the
   * caller returns straight to the extension for the sidebar to show, then
   * discards.
   */
  objectionSuggestions: string[];
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "update_scope",
  description: "Update the structured role-scoping state for this sales call based on the transcript so far.",
  input_schema: {
    type: "object",
    properties: {
      roles: {
        type: "array",
        description:
          "The full, current list of roles being discussed. Include every role from Current Roles that's still relevant, updated with any new info, plus any newly-detected roles.",
        items: {
          type: "object",
          properties: {
            id: {
              type: ["string", "null"],
              description:
                "Copy the id EXACTLY from Current Roles if this is the same role being discussed further. Use null only for a genuinely new role not in Current Roles.",
            },
            title: { type: ["string", "null"] },
            seniority: {
              type: ["string", "null"],
              enum: ["Junior", "Mid-Level", "Senior", "Senior+", "Senior++", "Senior+++", null],
              description:
                "MUST be exactly one of these values, not a free-text description — these are the only seniority levels that exist in our pricing data, and pricing lookup fails silently if this doesn't match exactly. Map years of experience: 0-2 yrs = Junior, 2-4 yrs = Mid-Level, 4-7 yrs = Senior, 7-10 yrs = Senior+, 10-15 yrs = Senior++, 15+ yrs = Senior+++. null if not addressed yet.",
            },
            region: {
              type: ["string", "null"],
              enum: ["Africa", "LATAM", "Both", null],
              description:
                "Only 'Both' if the client explicitly said region doesn't matter. null if not addressed yet.",
            },
            mustHaves: { type: "array", items: { type: "string" } },
            niceToHaves: { type: "array", items: { type: "string" } },
            confidence: {
              type: "number",
              description: "0-1 confidence that this role's scope is accurate and complete.",
            },
            sourceQuotes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  timestamp: { type: "string" },
                  quote: { type: "string" },
                },
                required: ["timestamp", "quote"],
              },
            },
            usaBenchmarkRole: {
              type: ["string", "null"],
              enum: [...USA_BENCHMARK_ROLES, null],
              description:
                "Pick whichever of these fixed categories is the closest real-world match for this role's title/responsibilities — used only to estimate what a comparable USA hire would cost, so a close semantic match is fine (e.g. 'Marketing Manager' -> 'Marketing', 'B2B Marketing Manager' -> 'Marketing', 'Sales Manager' -> 'Sales Operations'). null only if truly nothing on this list is a reasonable fit, or title isn't set yet.",
            },
            clientBudget: {
              type: ["number", "null"],
              description:
                "A specific monthly number the client stated they'd pay for THIS role. If they gave a range, use the TOP of it — e.g. '$3k to $4k' -> 4000. null until they've given an actual number; don't guess one from context.",
            },
            isTechRole: {
              type: "boolean",
              description:
                "True if this is a technical/engineering role (software engineer, data engineer, DevOps, QA, technical PM, AI/ML engineer, etc.) as opposed to sales, marketing, ops, support, finance, etc. Gates whether firstTask/successOutcome are required before a JD can be generated for this role.",
            },
            firstTask: {
              type: ["string", "null"],
              description:
                "The client's answer to 'what is the first thing this person will do when they start?' — a concrete initial task/project, not a vague generality. null until actually addressed in the transcript.",
            },
            successOutcome: {
              type: ["string", "null"],
              description:
                "The client's answer to 'if you had someone excellent in this role, what business outcomes would they help drive?' / 'what would the business actually look like as a result?' — null until actually addressed in the transcript.",
            },
            salaryAdjustments: {
              type: "object",
              description:
                "Cost premiums this role's requirements suggest, mirroring the standalone pricing calculator's adjustment checkboxes. Only set a flag true when the transcript actually supports it — default everything false, don't guess. See scoping-rules.md for full criteria.",
              properties: {
                englishLevel: {
                  type: "boolean",
                  description: "True only if the client explicitly requires near-native or native English — not just 'good English' or unstated.",
                },
                certainIndustries: {
                  type: "boolean",
                  description: "True if the role is specifically for a SaaS/Tech, Fintech, or Healthcare/Healthtech/Pharma client — industries with a documented cost premium.",
                },
                superNicheTech: {
                  type: "boolean",
                  description: "True if the role requires a genuinely niche/rare tool or technology stack that's harder to source for — not a common stack like 'React' or 'Python'.",
                },
                seniorityAnd360: {
                  type: "boolean",
                  description: "True for a managerial role, or a role with an unusually long/broad list of responsibilities spanning multiple functions.",
                },
              },
              required: ["englishLevel", "certainIndustries", "superNicheTech", "seniorityAnd360"],
            },
          },
          required: [
            "id",
            "title",
            "seniority",
            "region",
            "mustHaves",
            "niceToHaves",
            "confidence",
            "sourceQuotes",
            "usaBenchmarkRole",
            "clientBudget",
            "isTechRole",
            "firstTask",
            "successOutcome",
            "salaryAdjustments",
          ],
        },
      },
      scopeFlags: {
        type: "array",
        description:
          "Flags for missing info or budget mismatches. Do NOT include multiple_roles_bundled or missing_tech_answers flags — those are added programmatically.",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["missing_field", "budget_mismatch"] },
            message: { type: "string" },
            roleIds: { type: "array", items: { type: "string" } },
            resolved: { type: "boolean" },
            severity: {
              type: "string",
              enum: ["critical", "warning"],
              description: "Use 'warning' for these flag types — 'critical' is reserved for the programmatically-added missing_tech_answers flag.",
            },
          },
          required: ["type", "message", "roleIds", "resolved", "severity"],
        },
      },
      objectionSuggestions: {
        type: "array",
        description: "Suggested responses if the transcript shows objection/pushback language (price, competitor, timeline). Empty array if none.",
        items: { type: "string" },
      },
      callPhases: {
        type: "object",
        description:
          "Whether each phase of a healthy discovery call (see the call-structure conventions below) has been covered SO FAR based on the full transcript, regardless of order. Once true, a phase should generally stay true even if the conversation has since moved elsewhere — these track whether something has happened at all during the call, not the current topic.",
        properties: {
          agendaSet: { type: "boolean" },
          discoveryCovered: { type: "boolean" },
          consultativeDiagnosisGiven: { type: "boolean" },
          processExplained: { type: "boolean" },
          pricingDiscussed: { type: "boolean" },
          closeAttempted: { type: "boolean" },
        },
        required: [
          "agendaSet",
          "discoveryCovered",
          "consultativeDiagnosisGiven",
          "processExplained",
          "pricingDiscussed",
          "closeAttempted",
        ],
      },
    },
    required: ["roles", "scopeFlags", "objectionSuggestions", "callPhases"],
  },
};

// Extraction runs every ~2s for the life of the call, and re-sends
// whatever transcript it's given on every single call. Passing the FULL
// call history each time means the prompt (and therefore latency and cost)
// keeps growing the longer the call runs — a 40-minute call would be
// resending 40 minutes of transcript on every 2-second tick. currentRoles
// already carries everything extracted so far, so Claude only needs recent
// transcript to catch new/changed information, not the entire call.
const MAX_TRANSCRIPT_CHUNKS_FOR_EXTRACTION = 60;

export async function extractScope(
  transcript: TranscriptChunk[],
  currentRoles: RoleScope[],
  currentCallPhases: CallPhases
): Promise<ExtractResult> {
  const scopingRules = readConfigDoc("scoping-rules.md");
  const callScript = readConfigDoc("call-script.md");

  const recentTranscript = transcript.slice(-MAX_TRANSCRIPT_CHUNKS_FOR_EXTRACTION);
  const transcriptText = recentTranscript.map((c) => `[${c.timestamp}] ${c.speaker ?? "?"}: ${c.text}`).join("\n");
  const currentRolesJson = JSON.stringify(currentRoles, null, 2);
  const currentCallPhasesJson = JSON.stringify(currentCallPhases, null, 2);

  const system = `You are a role-scoping assistant for Scale Army sales calls. Extract structured role information from the live call transcript, detect scope creep and missing info, suggest objection handling, and track whether the call is covering the phases of a healthy discovery call.\n\nOur role-scoping conventions:\n\n${scopingRules}\n\nOur call-structure conventions:\n\n${callScript}`;

  const message = await getClient().messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4000,
    // This system prompt (and EXTRACT_TOOL below) is byte-identical on
    // every single extraction call -- only the user message (current
    // roles/phases/transcript) changes. Caching it means every call after
    // the first one on a given session pays full price only for that
    // dynamic user content, not the whole scoping-rules/call-script prompt
    // again. This is the single biggest lever on extraction cost given how
    // often this runs.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "update_scope" },
    messages: [
      {
        role: "user",
        content: `Current Roles (from before this update):\n${currentRolesJson}\n\nCurrent Call Phases (from before this update — only the most recent transcript window is shown below, so a phase already true here that isn't visible in it is still true; never flip a true back to false):\n${currentCallPhasesJson}\n\nMost recent transcript (Current Roles and Current Call Phases already reflect anything earlier that's been extracted):\n${transcriptText}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Claude did not return a tool_use block for update_scope.");
  }

  return toolUse.input as ExtractResult;
}

export async function generateJobDescription(role: RoleScope): Promise<string> {
  const template = readConfigDoc("jd-template.md");

  // The template doc is mostly prose/examples for a human to read; the
  // actual system prompt Claude should follow is the whole thing between
  // the first `---` and the `## Notes for whoever wires this in` section.
  const promptStart = template.indexOf("---") + 3;
  const promptEnd = template.indexOf("## Notes for whoever wires this in");
  const system = template.slice(promptStart, promptEnd > -1 ? promptEnd : undefined).trim();

  const userMessage = `Role: ${role.title}\nSeniority: ${role.seniority}\nRegion: ${role.region}\nMust-haves: ${role.mustHaves.join(", ") || "None specified"}\nNice-to-haves: ${role.niceToHaves.join(", ") || "None specified"}`;

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const raw = textBlock?.text ?? "";

  // Safety net matching the source tool's own cleanup, in case Claude
  // sneaks in markdown despite the "plain text only" instruction.
  return raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^_([^_]+)_/gm, "$1")
    .trim();
}

/**
 * One-shot recap generated on demand from the dashboard (Phase 4), not
 * during the live call — reads the full transcript plus whatever
 * roles/quote/flags were already extracted and writes a plain-English
 * summary of what was agreed. Not fed back into extraction; this is purely
 * for a human reading the session afterward.
 */
export async function generateCallSummary(session: CallSession): Promise<string> {
  const transcriptText = session.transcript
    .map((c) => `[${c.timestamp}] ${c.speaker ?? "?"}: ${c.text}`)
    .join("\n");

  const system =
    "You write short, plain-English recaps of Scale Army sales scoping calls for a manager reviewing the deal afterward. " +
    "Cover: what role(s) were scoped and their key requirements, what was agreed on pricing (or left open), any unresolved flags/objections, and concrete next steps. " +
    "Plain prose in short paragraphs, no markdown headers or bullet-heavy formatting, a few sentences per topic. If something wasn't addressed on the call, say so plainly rather than omitting it.";

  const userMessage = `Roles scoped:\n${JSON.stringify(session.roles, null, 2)}\n\nQuote/pricing state:\n${JSON.stringify(session.quote, null, 2)}\n\nOpen flags:\n${JSON.stringify(session.scopeFlags.filter((f) => !f.resolved), null, 2)}\n\nFull transcript:\n${transcriptText}`;

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return (textBlock?.text ?? "").trim();
}
