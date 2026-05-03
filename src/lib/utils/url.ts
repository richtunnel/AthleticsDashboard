import { getSiteUrl } from "./siteUrl";

/**
 * Normalizes a URL to be browser-compatible.
 *
 * In production, if the URL contains 0.0.0.0 (the server's bind address leaking
 * through a misconfigured reverse proxy) it is rewritten to the public site URL
 * from env (NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL / NEXT_PUBLIC_APP_URL).
 *
 * In development, 0.0.0.0 is rewritten to localhost so browsers can reach it.
 *
 * @param url - The URL to normalize
 * @returns A URL that can be safely sent to a browser or external service
 */
export function normalizeBrowserUrl(url: string): string {
  if (!url.includes("://0.0.0.0")) {
    return url;
  }

  if (process.env.NODE_ENV === "production") {
    // In prod, 0.0.0.0 means the proxy didn't rewrite Host — fall back to env.
    try {
      const siteOrigin = new URL(getSiteUrl()).origin;
      const parsed = new URL(url);
      return `${siteOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return url.replace("://0.0.0.0", "://localhost");
    }
  }

  return url.replace("://0.0.0.0", "://localhost");
}
