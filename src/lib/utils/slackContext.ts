import type { NextRequest } from "next/server";
import { extractRequestMetadataFromHeaders } from "./requestMetadata";

/**
 * Best-effort browser/OS extraction from a User-Agent string. Doesn't need
 * to be perfect — Slack staff just want a quick "Chrome on macOS" at a glance.
 * Use a real parser (ua-parser-js) if/when we need precise stats.
 */
function summariseUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;

  // Browser
  let browser: string;
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) browser = "Safari";
  else browser = "Other";

  // OS
  let os: string;
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  else os = "Other";

  return `${browser} on ${os}`;
}

export interface SlackContext {
  /** Caller name if available. */
  name?: string | null;
  /** Caller email. */
  email?: string | null;
  /** DB user id when authenticated; otherwise null. */
  userId?: string | null;
  /** Caller role (AD / PARENT / etc) when known. */
  role?: string | null;
  /** Best-effort IP from forwarded headers. */
  ip?: string | null;
  /** Friendly "Chrome on macOS" summary of the User-Agent. */
  browser?: string | null;
  /** Raw UA — sometimes useful in critical-error reports. */
  userAgent?: string | null;
  /** The pathname the user was on when the event fired. */
  pathname?: string | null;
  /** ISO timestamp of the event. */
  timestamp: string;
}

interface SessionLike {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
}

/**
 * Build a SlackContext from a NextRequest + optional session. Safe to call
 * with partial data — missing fields are just null. Use this for every
 * notifySlack({ context: toSlackContextRecord(buildSlackContext(...)) })
 * call so all events have a uniform shape in Slack.
 */
export function buildSlackContext(
  request: NextRequest | undefined,
  session?: SessionLike | null,
  extra?: Partial<SlackContext>
): SlackContext {
  const meta = request
    ? extractRequestMetadataFromHeaders(request.headers)
    : { ip: null, userAgent: null };

  return {
    name: session?.user?.name ?? extra?.name ?? null,
    email: session?.user?.email ?? extra?.email ?? null,
    userId: session?.user?.id ?? extra?.userId ?? null,
    role: session?.user?.role ?? extra?.role ?? null,
    ip: meta.ip ?? extra?.ip ?? null,
    browser: summariseUserAgent(meta.userAgent) ?? extra?.browser ?? null,
    userAgent: meta.userAgent ?? extra?.userAgent ?? null,
    pathname:
      request?.nextUrl?.pathname ?? extra?.pathname ?? null,
    timestamp: extra?.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Flatten a SlackContext into the key→value record `notifySlack()` accepts
 * for its `context` field. Empty/null fields are dropped so Slack doesn't
 * render blank rows. The `userAgent` field is excluded by default — too noisy
 * for most channels; pass `includeUserAgent: true` for critical-errors.
 */
export function toSlackContextRecord(
  ctx: SlackContext,
  options: { includeUserAgent?: boolean } = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  if (ctx.name) out.Name = ctx.name;
  if (ctx.email) out.Email = ctx.email;
  if (ctx.userId) out["User ID"] = ctx.userId;
  if (ctx.role) out.Role = ctx.role;
  if (ctx.ip) out.IP = ctx.ip;
  if (ctx.browser) out.Browser = ctx.browser;
  if (ctx.pathname) out.Pathname = ctx.pathname;
  out.Timestamp = ctx.timestamp;
  if (options.includeUserAgent && ctx.userAgent) {
    out["User Agent"] = ctx.userAgent;
  }
  return out;
}
