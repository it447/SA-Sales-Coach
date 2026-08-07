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

## Config

`src/config.ts` (added in Phase 3) will hold the backend API base URL. Once
that's set, `manifest.json`'s `host_permissions` needs the API's domain
added alongside `meet.google.com` so the content script/background worker
can call it cross-origin.
