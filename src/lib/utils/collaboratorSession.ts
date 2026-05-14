import { decode } from "next-auth/jwt";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";
import { collaboratorAuthOptions } from "@/lib/utils/collaboratorAuthOptions";

/**
 * Cookie name for the collaborator session token.
 * Must match the cookie name in collaboratorAuthOptions.
 */
export const COLLABORATOR_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-collaborator-session-token"
    : "collaborator-session-token";

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
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, role: true },
    });
    if (user) return user;
  }

  return null;
}

/**
 * Reads and validates the collaborator session cookie.
 * Returns null when no valid collaborator session is present.
 */
export async function getCollaboratorSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) return null;

  const cookieValue = cookieStore.get(COLLABORATOR_COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  try {
    const decoded = await decode({ token: cookieValue, secret });
    if (!decoded?.email && !decoded?.sub) return null;

    const dbUser = await resolveDbUser(decoded as Record<string, unknown>);
    if (!dbUser) return null;

    const patchedDecoded = { ...decoded, email: dbUser.email };
    return buildSessionFromToken(patchedDecoded as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Middleware helper — checks the collaborator cookie then falls back to main.
 */
export async function getCollaboratorOrMainToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  const collaboratorToken = await getToken({
    req,
    secret,
    cookieName: COLLABORATOR_COOKIE_NAME,
  });
  if (collaboratorToken?.sub) return collaboratorToken;

  const mainToken = await getToken({ req, secret });
  if (mainToken?.sub) return mainToken;

  return null;
}

/**
 * getAnySession — drop-in replacement for `getServerSession(authOptions)` in
 * dashboard API routes.
 *
 * Checks the main session first (covers all existing ADs / legacy collaborators
 * who signed in via the main auth flow).  Falls back to the collaborator cookie
 * so collaborators who signed in through /api/auth/collaborator also work.
 *
 * Usage:
 *   import { getAnySession } from "@/lib/utils/collaboratorSession";
 *   const session = await getAnySession();
 */
export async function getAnySession(): Promise<Session | null> {
  const mainSession = await getServerSession(authOptions);
  if (mainSession) return mainSession;

  return await getCollaboratorSession();
}
