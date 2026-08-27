"use client";

import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { colors } from "../../lib/theme";
import { Card, Button } from "../../components/ui";

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  return (
    <main style={{ maxWidth: "420px", margin: "4rem auto", padding: "0 1.5rem" }}>
      <Card title="Deal Assistant">
        <p style={{ color: colors.beige, marginBottom: "1.5rem" }}>
          Sign in with your Scale Army Google account to view call sessions.
        </p>
        {error === "AccessDenied" && (
          <p style={{ color: colors.redAccent, marginBottom: "1rem" }}>
            That account isn&apos;t on the @scalearmy.com domain — sign in with your
            work Google account instead.
          </p>
        )}
        <Button onClick={() => signIn("google", { callbackUrl })}>
          Sign in with Google
        </Button>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
