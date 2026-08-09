# Deal Assistant — Chrome extension

Manifest V3 extension for `meet.google.com`. See the root README for the
full project overview.

## Build

```bash
npm install
npm run build   # -> dist/
```

## Load unpacked (internal install, no Web Store listing yet)

1. `chrome://extensions`
2. Enable "Developer mode"
3. "Load unpacked" -> select this `extension/` folder
4. Pin the extension so the popup is reachable from the toolbar

## First-time setup (each rep does this once)

1. Click the Deal Assistant icon in the toolbar.
2. Fill in:
   - **API base URL** — defaults to `https://sa-sales-coach.vercel.app`, only change this if testing against a different deployment.
   - **API key** — the same value as `INTERNAL_API_KEY` in the backend's environment variables. Ask whoever manages the Vercel project for this.
   - **Your email** — used as `repEmail` on sessions you create.
3. Click "Save Settings".

## Using it on a call

1. Join a Google Meet call and turn on **live captions** (the "CC" button in Meet's controls) — the sidebar can't read the transcript without them.
2. Click the Deal Assistant icon -> "Start Call". This creates a session for the current Meet link.
3. The coaching sidebar appears on the right side of the page and updates as the call progresses: detected roles (editable), scope-creep/missing-info flags, objection-handling suggestions, and pricing once enough is scoped.

## Known limitation: caption scraping is best-effort

Google Meet has no public API for captions. `src/content/captions.ts` reads
them via the `aria-live` accessibility attribute, which has stayed
reasonably stable across Meet UI changes (Google can't remove it without
breaking screen-reader support) — but it's not officially documented and
could break if Meet changes how captions are rendered. If captions stop
being picked up after a Meet update, that file is the first place to check:
open a real call with captions on, inspect the DOM, and adjust the selector.

## Testing against a non-production deployment

If `apiBaseUrl` in settings points somewhere other than
`https://sa-sales-coach.vercel.app`, add that domain to
`host_permissions` in `manifest.json` too (extensions can only fetch
cross-origin, bypassing CORS, to domains they've declared) and reload the
unpacked extension.
