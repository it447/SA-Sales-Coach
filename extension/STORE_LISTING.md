# Chrome Web Store listing — copy/paste reference

Everything needed to fill in the Web Store Developer Dashboard when
submitting `deal-assistant-extension.zip`. Keep this in sync if the
listing details change later.

## Basic info

**Name:** Deal Assistant

**Short description** (≤132 characters):
```
Internal Scale Army tool: live coaching sidebar for sales calls on Google Meet — scoping, pricing, JDs.
```

**Detailed description:**
```
Deal Assistant is an internal Scale Army tool that joins our sales team's Google Meet calls and coaches reps live: scoping roles, catching scope creep, calculating margin, suggesting objection handling, and generating job descriptions once a deal is priced.

This is a private, internal-only tool — not for external distribution or use outside Scale Army.

How it works:
1. Turn on live captions in Google Meet.
2. Start a call session from the extension popup.
3. A coaching sidebar appears showing detected roles, scope flags, objection-handling suggestions, and pricing as the call progresses.

Requires an internal API key from Scale Army IT to function.
```

**Category:** Productivity (closest fit — Web Store doesn't have a "sales tools" category)

**Language:** English

## Privacy practices tab

**Single purpose description:**
```
Reads live Google Meet captions during a call and sends them to Scale Army's internal backend to provide real-time sales-call coaching (role scoping, pricing, objection handling, job description generation) to the rep on the call.
```

**Permission justifications** (also documented at `/privacy` on the deployed backend):

| Permission | Justification |
|---|---|
| `storage` | Remembers the rep's API key and which call session is active for the current tab, locally in the browser. |
| `activeTab` | Detects whether the current tab is a Google Meet call, so the extension knows when to activate. |
| `host_permissions: meet.google.com` | Reads live caption text from the page (the core function of the tool) and injects the coaching sidebar. |
| `host_permissions: sa-sales-coach.vercel.app` | Sends transcript data to and receives coaching results from Scale Army's own backend. |

**Data usage disclosure:** Yes, this extension collects/transmits user-generated content (call transcript text) and communicates with a remote server (Scale Army's own backend). It does not sell data, use it for advertising, or share it with anyone besides Anthropic (for LLM processing) and Scale Army's own internal systems.

**Privacy policy URL:**
```
https://sa-sales-coach.vercel.app/privacy
```

## Visibility

Set to **Private**. If the Workspace organization restriction option is
available (requires the developer account's domain to be a verified
Google Workspace org), restrict to `scalearmy.com` — otherwise use
"Trusted testers" and add each rep's email individually.

## Screenshots

At least one screenshot (1280x800 or 640x400) of the sidebar actually
working, taken during local testing (see `extension/README.md`).
