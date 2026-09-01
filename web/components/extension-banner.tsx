import { colors } from "../lib/theme";
import { Card, Button } from "./ui";

const WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/deal-assistant/imnbdgffdbhckckjcakmiddkmojgagdc";

/** Shown on the dashboard and login pages so reps who haven't installed the extension yet know where to get it and what to do next. */
export function ExtensionBanner() {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p style={{ color: colors.cream, fontWeight: "bold", marginBottom: "0.25rem" }}>
            Get the Deal Assistant Chrome extension
          </p>
          <p style={{ color: colors.beige, fontSize: "0.85rem" }}>
            Adds the live coaching sidebar to Google Meet calls.
          </p>
        </div>
        <a href={WEB_STORE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <Button>Add to Chrome</Button>
        </a>
      </div>
      <ol style={{ color: colors.beige, fontSize: "0.85rem", marginTop: "1rem", paddingLeft: "1.25rem" }}>
        <li>Click &quot;Add to Chrome&quot; above and confirm the install.</li>
        <li>
          Click the extension icon in your Chrome toolbar and enter your Scale Army API key (ask IT if
          you don&apos;t have one).
        </li>
        <li>
          Turn on live captions in Google Meet (the &quot;CC&quot; button) — the sidebar needs captions on to work.
        </li>
        <li>Join your call — a session starts and the coaching sidebar appears automatically.</li>
      </ol>
    </Card>
  );
}
