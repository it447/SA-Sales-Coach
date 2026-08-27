import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Human-facing login for the dashboard (Phase 4) — distinct from
 * requireAuth() in lib/auth.ts, which gates the extension's API calls with
 * a shared bearer token. Only @scalearmy.com Google accounts may sign in;
 * anyone else is rejected in the signIn callback before a session is ever
 * created.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // Nudges Google's account chooser toward Workspace accounts on
          // this domain; the real enforcement is the signIn callback below.
          hd: "scalearmy.com",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email ?? "";
      return email.toLowerCase().endsWith("@scalearmy.com");
    },
  },
};
