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
 * Resolve the DB user from a decoded JWT.
 *
 * Tries by `sub` (the JWT subject = DB user.id) first — this is the most
 * stable identifier. Falls back to a case-insensitive email search for
 * situations where the sub is stale or missing.
 *
 * Returns the DB user record (with its canonical email) or null if the
 * user doesn't exist in this environment's database.
 */
async function resolveDbUser(decoded: Record<string, unknown>) {
  const sub = decoded.sub as string | undefined;
  const email = decoded.email as string | undefined;

  if (sub) {
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, role: true },
    });
    if (user) return user;
  }

  if (email) {
    // Case-insensitive fallback (handles Gmail alias differences, etc.)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, role: true },
    });
    if (user) return user;
  }

  return null;
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
 *
 * Both paths verify the user actually exists in the DB before returning a
 * session. This prevents phantom sessions (e.g. a cookie from a different
 * environment / database) from propagating as valid 404s downstream.
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
      if (decoded?.email || decoded?.sub) {
        const dbUser = await resolveDbUser(decoded as Record<string, unknown>);
        if (dbUser) {
          // Patch the decoded token with the canonical DB email so all
          // downstream callers always see an email that matches the DB.
          const patchedDecoded = { ...decoded, email: dbUser.email };
          return buildSessionFromToken(patchedDecoded as Record<string, unknown>);
        }
        // JWT valid but user doesn't exist in this DB — fall through.
        console.warn(
          "[getParentSession] parent cookie decoded but user not found in DB",
          { sub: decoded.sub, email: decoded.email }
        );
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
      if (decoded?.email || decoded?.sub) {
        const dbUser = await resolveDbUser(decoded as Record<string, unknown>);

        if (!dbUser) return null;

        // If user is a PARENT role, allow
        if (dbUser.role === "PARENT") {
          const patchedDecoded = { ...decoded, email: dbUser.email };
          return buildSessionFromToken(patchedDecoded as Record<string, unknown>);
        }

        // If user has parentAthleteLink records, allow (AD who is also a parent)
        const parentLink = await prisma.parentAthleteLink.findFirst({
          where: { parentUserId: dbUser.id },
          select: { id: true },
        });

        if (parentLink) {
          const patchedDecoded = { ...decoded, email: dbUser.email };
          return buildSessionFromToken(patchedDecoded as Record<string, unknown>);
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
