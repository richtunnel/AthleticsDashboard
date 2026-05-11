import { decode } from "next-auth/jwt";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import type { Session } from "next-auth";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/database/prisma";

/**
 * Cookie name for the parent session token.
 * Must match the cookie name in parentAuthOptions.
 */
const PARENT_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-parent-session-token"
    : "parent-session-token";

const MAIN_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * Builds a NextAuth-compatible Session object from a decoded JWT token.
 */
function buildSessionFromToken(decoded: Record<string, unknown>): Session {
  const exp = decoded.exp as number | undefined;
  return {
    user: {
      email: decoded.email as string,
      name: (decoded.name as string | null | undefined) ?? null,
      image: (decoded.picture as string | null | undefined) ?? null,
      id: decoded.sub as string,
      role: decoded.role as string,
      organizationId: decoded.organizationId as string,
      organization: (decoded.organization ?? {
        id: "",
        name: "",
        timezone: "America/New_York",
      }) as { id: string; name: string; timezone: string },
    } as Session["user"],
    expires: exp
      ? new Date(exp * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Server-side helper to get a parent session.
 *
 * Uses next/headers cookies() (properly awaited for Next.js 15) and
 * decode() from next-auth/jwt to bypass getServerSession(), which in
 * Next.js 15 App Router API routes does NOT correctly read custom-named
 * cookies because it calls cookies() synchronously internally.
 *
 * Checks the parent cookie first (for standalone parent users),
 * then falls back to the main cookie (for ADs who are also parents
 * accessing the parent dashboard via their AD session).
 */
export async function getParentSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    console.error("[getParentSession] NEXTAUTH_SECRET is not set");
    return null;
  }

  // ── 1. Try the dedicated parent session cookie ────────────────────────────
  const parentCookieValue = cookieStore.get(PARENT_COOKIE_NAME)?.value;
  if (parentCookieValue) {
    try {
      const decoded = await decode({ token: parentCookieValue, secret });
      if (decoded?.email) {
        return buildSessionFromToken(decoded as Record<string, unknown>);
      }
    } catch {
      // Token invalid or expired — fall through to main cookie
    }
  }

  // ── 2. Fall back to the main session cookie (AD-as-parent case) ──────────
  const mainCookieValue = cookieStore.get(MAIN_COOKIE_NAME)?.value;
  if (mainCookieValue) {
    try {
      const decoded = await decode({ token: mainCookieValue, secret });
      if (decoded?.email) {
        const email = decoded.email as string;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        });

        if (!user) return null;

        // If user is a PARENT role, allow
        if (user.role === "PARENT") {
          return buildSessionFromToken(decoded as Record<string, unknown>);
        }

        // If user has parentAthleteLink records, allow (AD who is also a parent)
        const parentLink = await prisma.parentAthleteLink.findFirst({
          where: { parentUserId: user.id },
          select: { id: true },
        });

        if (parentLink) {
          return buildSessionFromToken(decoded as Record<string, unknown>);
        }
      }
    } catch {
      // Token invalid or expired
    }
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
