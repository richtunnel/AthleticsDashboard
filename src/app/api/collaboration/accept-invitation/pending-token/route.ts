import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { INVITATION_COOKIE_NAME } from "@/lib/utils/invitation";

/**
 * GET /api/collaboration/accept-invitation/pending-token
 *
 * Returns the pending invitation token stored in the httpOnly
 * `pending_invitation_token` cookie (set by the accept-invitation GET route
 * when the user first clicks the email link).
 *
 * The /accept-invitation page reads the token from the URL, but the token gets
 * dropped from the URL across the signup / OAuth round-trip. This lets the page
 * fall back to the cookie so the invitee never sees "No invitation token
 * provided" after signing up.
 *
 * Public on purpose — the invitee isn't authenticated yet. It only echoes back a
 * token the caller already holds in their own cookie; the token is still fully
 * verified by the accept routes before anything happens. Lives under the
 * accept-invitation path so the middleware's existing public allowlist covers it.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITATION_COOKIE_NAME)?.value ?? null;
  return NextResponse.json({ token });
}
