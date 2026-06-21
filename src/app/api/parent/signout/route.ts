import { NextResponse } from "next/server";
import { clearAllSessionCookies } from "@/lib/utils/clearSessionCookies";

/**
 * POST /api/parent/signout
 *
 * Clears ALL auth session cookies (not just the parent one) after parent
 * account deletion or manual sign-out. A partial clear left an AD session
 * registered under the same email alive, logging the user straight back in.
 * Delegates to the shared clearAllSessionCookies().
 */
export async function POST() {
  await clearAllSessionCookies();
  return NextResponse.json({ success: true });
}
