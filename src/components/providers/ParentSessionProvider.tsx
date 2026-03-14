"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Session provider for parent-specific authentication.
 *
 * Uses basePath="/api/auth/parent" so that all client-side auth calls
 * (signIn, signOut, useSession, getSession) route to the parent
 * NextAuth instance with its own cookie.
 *
 * This allows a parent and an Athletic Director to be logged in
 * simultaneously in the same browser.
 */
export default function ParentSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/api/auth/parent">{children}</SessionProvider>;
}
