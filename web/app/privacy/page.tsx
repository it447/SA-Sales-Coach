import { colors } from "../../lib/theme";
import { Card } from "../../components/ui";

export const metadata = {
  title: "Privacy Policy — Deal Assistant",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ color: colors.cream, fontSize: "1.5rem", marginBottom: "1.5rem" }}>
        Deal Assistant — Privacy Policy
      </h1>

      <Card>
        <p style={{ color: colors.beige, marginBottom: "1rem" }}>
          Deal Assistant is an internal tool built by and for Scale Army employees. It is not
          distributed publicly and is not intended for use by anyone outside the company.
        </p>

        <h3 style={{ color: colors.orange, marginTop: "1rem", marginBottom: "0.5rem" }}>
          What data this extension collects
        </h3>
        <p style={{ color: colors.beige, marginBottom: "1rem" }}>
          While active on a Google Meet call, the Deal Assistant Chrome extension reads live
          caption text displayed by Google Meet (only when captions are turned on) and sends it,
          along with basic call metadata (the Meet link and the rep&apos;s email address), to
          Scale Army&apos;s own backend for processing.
        </p>

        <h3 style={{ color: colors.orange, marginTop: "1rem", marginBottom: "0.5rem" }}>
          How that data is used
        </h3>
        <p style={{ color: colors.beige, marginBottom: "1rem" }}>
          Call transcript text is sent to Anthropic&apos;s Claude API to extract role details,
          detect scope issues, suggest objection-handling responses, and draft job descriptions.
          It is also stored in Scale Army&apos;s own database (hosted on Vercel/Postgres) so the
          rep can review and edit the results during and after the call.
        </p>

        <h3 style={{ color: colors.orange, marginTop: "1rem", marginBottom: "0.5rem" }}>
          Who has access
        </h3>
        <p style={{ color: colors.beige, marginBottom: "1rem" }}>
          Only Scale Army employees with access to the internal backend and database. Data is
          never sold, shared with advertisers, or used for any purpose beyond running this
          internal tool. It is shared with exactly one third party — Anthropic, solely to process
          the transcript text as described above, subject to Anthropic&apos;s own API data-handling
          terms.
        </p>

        <h3 style={{ color: colors.orange, marginTop: "1rem", marginBottom: "0.5rem" }}>
          Permissions this extension requests, and why
        </h3>
        <ul style={{ color: colors.beige, paddingLeft: "1.25rem" }}>
          <li>
            <strong>storage</strong> — to remember your API key and which call session is active,
            locally in your browser.
          </li>
          <li>
            <strong>activeTab</strong> — to detect whether the current tab is a Google Meet call.
          </li>
          <li>
            <strong>Host access to meet.google.com</strong> — to read live caption text from the
            page and display the coaching sidebar.
          </li>
          <li>
            <strong>Host access to Scale Army&apos;s own backend</strong> — to send transcript data
            and receive coaching results back.
          </li>
        </ul>

        <h3 style={{ color: colors.orange, marginTop: "1rem", marginBottom: "0.5rem" }}>
          Contact
        </h3>
        <p style={{ color: colors.beige }}>
          Questions about this tool or its data handling: contact Scale Army IT
          (it@scalearmy.com).
        </p>
      </Card>
    </main>
  );
}
