import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

/**
 * Module augmentation so `session.user.isAdmin` / `token.isAdmin` type-check
 * — set in lib/authOptions.ts's jwt/session callbacks based on the signed-in
 * email, not stored anywhere else.
 */
declare module "next-auth" {
  interface Session {
    user?: {
      isAdmin?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}
