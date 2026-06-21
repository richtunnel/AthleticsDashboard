import { cookies } from "next/headers";

/**
 * Server-side: clear EVERY auth session cookie — main/AD
 * (`next-auth.session-token`), parent (`parent-session-token`) and collaborator
 * (`collaborator-session-token`), plus their csrf/callback/state/pkce/nonce
 * cookies — in both prod (`__Secure-`/`__Host-`) and dev variants.
 *
 * Single source of truth used by every sign-out AND account-deletion path so a
 * session is NEVER left behind (the same email can hold both an AD and a parent
 * account; clearing only one cookie logs the user back into the other). Cookies
 * are matched by name marker rather than a hardcoded list, so new auth cookie
 * variants are cleared automatically.
 */
export async function clearAllSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  const isAuthCookie = (name: string) =>
    name.includes("next-auth") || name.includes("session-token") || name.includes("authjs");

  for (const cookie of cookieStore.getAll()) {
    if (!isAuthCookie(cookie.name)) continue;
    // Overwrite with an immediately-expired cookie. secure + path="/" + no domain
    // satisfies the __Host-/__Secure- prefix requirements in production.
    cookieStore.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });
  }
}
