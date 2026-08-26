import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import path from "path";
import { USA_BENCHMARK_ROLES } from "./types";
import type { RoleScope, ScopeFlag, TranscriptChunk } from "./types";

// Matches the model already in production use by the scale-army-jd-tool
// agent, for consistency across our internal tools.
const MODEL = "claude-sonnet-4-6";

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
          ],
        },
      },
      scopeFlags: {
        type: "array",
        description: "Flags for missing info or budget mismatches. Do NOT include multiple_roles_bundled flags — those are added programmatically.",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["missing_field", "budget_mismatch"] },
            message: { type: "string" },
            roleIds: { type: "array", items: { type: "string" } },
            resolved: { type: "boolean" },
          },
          required: ["type", "message", "roleIds", "resolved"],
        },
      },
      objectionSuggestions: {
        type: "array",
        description: "Suggested responses if the transcript shows objection/pushback language (price, competitor, timeline). Empty array if none.",
        items: { type: "string" },
      },
    },
    required: ["roles", "scopeFlags", "objectionSuggestions"],
  },
};

export async function extractScope(
  transcript: TranscriptChunk[],
  currentRoles: RoleScope[]
): Promise<ExtractResult> {
  const scopingRules = readConfigDoc("scoping-rules.md");

  const transcriptText = transcript.map((c) => `[${c.timestamp}] ${c.speaker ?? "?"}: ${c.text}`).join("\n");
  const currentRolesJson = JSON.stringify(currentRoles, null, 2);

  const system = `You are a role-scoping assistant for Scale Army sales calls. Extract structured role information from the live call transcript, detect scope creep and missing info, and suggest objection handling.\n\nOur role-scoping conventions:\n\n${scopingRules}`;

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "update_scope" },
    messages: [
      {
        role: "user",
        content: `Current Roles (from before this update):\n${currentRolesJson}\n\nTranscript so far:\n${transcriptText}`,
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
