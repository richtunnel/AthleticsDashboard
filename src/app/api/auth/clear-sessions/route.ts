import { NextResponse } from "next/server";
import { clearAllSessionCookies } from "@/lib/utils/clearSessionCookies";

/**
 * POST /api/auth/clear-sessions
 *
 * Clears EVERY auth session cookie (AD/main, parent, collaborator) regardless of
 * which dashboard initiated sign-out. Same email can hold both an AD and a parent
 * account; NextAuth signOut() only clears its own instance's cookie, so without
 * this the other session survives and logs the user back into the wrong
 * dashboard. Delegates to the shared clearAllSessionCookies() used by all
 * sign-out / account-deletion paths.
 *
 * Lives under /api/auth/* which the middleware treats as public, so it works
 * even when the current session is partial or already gone.
 */
export async function POST() {
  await clearAllSessionCookies();
  return NextResponse.json({ success: true });
}
