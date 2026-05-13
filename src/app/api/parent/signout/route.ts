import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * POST /api/parent/signout
 *
 * Clears the parent session cookie so the browser no longer carries a stale
 * parent-session-token after account deletion or manual sign-out.
 */
export async function POST() {
  const cookieStore = await cookies();

  // Delete the parent-specific session cookie set by parentAuthOptions
  cookieStore.delete("parent-session-token");

  return NextResponse.json({ success: true });
}
