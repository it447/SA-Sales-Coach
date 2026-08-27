import Image from "next/image";
import Link from "next/link";
import { colors } from "../lib/theme";
import { Card, Button } from "../components/ui";

export default function HomePage() {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <Image src="/logo.png" alt="" width={40} height={40} />
        <h1 style={{ color: colors.cream, fontSize: "1.75rem" }}>Deal Assistant</h1>
      </div>

      <Card title="Internal tool">
        <p style={{ color: colors.beige, marginBottom: "1.5rem" }}>
          This is the backend for the Deal Assistant Chrome extension. View
          past call sessions, transcripts, and recaps in the dashboard.
        </p>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <Button>View call sessions</Button>
        </Link>
      </Card>
    </main>
  );
}
