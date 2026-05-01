function ensureProtocol(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.NEXTAUTH_URL || process.env.APP_URL;

  const vercelUrl = process.env.VERCEL_URL;

  const raw = fromEnv ? ensureProtocol(fromEnv) : vercelUrl ? ensureProtocol(vercelUrl) : "http://localhost:3000";

  return raw.replace(/\/$/, "");
}

export function getSiteUrlAsUrl(): URL {
  return new URL(getSiteUrl());
}

/**
 * Normalizes an application URL, replacing 0.0.0.0 with localhost for local development
 * and ensuring correct production domain.
 */
export function normalizeAppUrl(url?: string): string {
  let appUrl = url || getSiteUrl();
  
  // In production, ensure we don't use 0.0.0.0
  if (process.env.NODE_ENV === "production" && (appUrl.includes("0.0.0.0") || appUrl.includes("localhost"))) {
    // If we're in production but URL is local, try to use a default or env
    appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://opletics.com";
  } else if (appUrl.includes("0.0.0.0")) {
    // For local development with Docker, replace 0.0.0.0 with localhost
    appUrl = appUrl.replace("0.0.0.0", "localhost");
  }
  
  return appUrl.replace(/\/$/, "");
}
