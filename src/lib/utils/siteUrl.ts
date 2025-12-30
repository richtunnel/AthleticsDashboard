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
