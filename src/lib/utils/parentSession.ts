import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { parentAuthOptions } from "@/lib/utils/parentAuthOptions";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

/**
 * Cookie name for the parent session token.
 * Must match the cookie name in parentAuthOptions.
 */
const PARENT_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Secure-parent-session-token" : "parent-session-token";

/**
 * Server-side helper to get a parent session.
 *
 * Checks the parent cookie first (for standalone parent users),
 * then falls back to the main cookie (for ADs who are also parents
 * accessing the parent dashboard via their AD session).
 */
export async function getParentSession() {
  // 1. Try the dedicated parent session cookie
  const parentSession = await getServerSession(parentAuthOptions);
  if (parentSession?.user?.email) {
    return parentSession;
  }

  // 2. Fall back to the main session (AD-as-parent case)
  const mainSession = await getServerSession(authOptions);
  if (mainSession?.user?.email) {
    // Verify user has parent links — only allow access if they're actually a parent too
    const user = await prisma.user.findUnique({
      where: { email: mainSession.user.email },
      select: { id: true, role: true },
    });

    if (!user) return null;

    // If user is a PARENT role, allow
    if (user.role === "PARENT") return mainSession;

    // If user has parentAthleteLink records, allow (AD who is also a parent)
    const parentLink = await prisma.parentAthleteLink.findFirst({
      where: { parentUserId: user.id },
      select: { id: true },
    });

    if (parentLink) return mainSession;
  }

  return null;
}

/**
 * Middleware helper to get a parent token from the request.
 *
 * Checks the parent cookie first, then falls back to the main cookie.
 * Used in middleware.ts for protecting parent routes.
 */
export async function getParentToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  // 1. Try the dedicated parent session cookie
  const parentToken = await getToken({ req, secret, cookieName: PARENT_COOKIE_NAME });
  if (parentToken?.sub) {
    return parentToken;
  }

  // 2. Fall back to the main session cookie
  const mainToken = await getToken({ req, secret });
  if (mainToken?.sub) {
    return mainToken;
  }

  return null;
}
