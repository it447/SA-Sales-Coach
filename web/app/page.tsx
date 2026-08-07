import Image from "next/image";
import { colors } from "../lib/theme";
import { Card } from "../components/ui";

export default function HomePage() {
  return (
    <main style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <Image src="/logo.png" alt="" width={40} height={40} />
        <h1 style={{ color: colors.cream, fontSize: "1.75rem" }}>Deal Assistant</h1>
      </div>

      <Card title="Internal tool">
        <p style={{ color: colors.beige }}>
          This is the backend for the Deal Assistant Chrome extension. There
          is no end-user UI here yet beyond the internal dashboard (Phase 4).
        </p>
      </Card>
    </main>
  );
}
