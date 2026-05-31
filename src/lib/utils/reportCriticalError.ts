import type { NextRequest } from "next/server";
import { notifySlack } from "@/lib/services/slack.service";
import { buildSlackContext, toSlackContextRecord } from "./slackContext";

/**
 * Fire-and-forget critical-error notification. Wraps notifySlack in another
 * try/catch so a failure in error reporting itself can never escape and bring
 * down the caller's already-failing request.
 *
 * Usage
 * ─────
 *   } catch (error) {
 *     console.error(...);
 *     await reportCriticalError(request, error, { source: "/api/foo" });
 *     return NextResponse.json({ error: "..." }, { status: 500 });
 *   }
 *
 * The Slack message includes:
 *   • Error name + message + stack (truncated to ~2.5 KB to fit Slack blocks)
 *   • Caller IP / browser / pathname / timestamp / userAgent
 *   • Any extra key-value pairs passed in `extra`
 */
export async function reportCriticalError(
  request: NextRequest | undefined,
  error: unknown,
  extra?: Record<string, string | number | boolean | null | undefined>
): Promise<void> {
  try {
    const ctx = buildSlackContext(request);
    const errName = error instanceof Error ? error.name : "UnknownError";
    const errMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? "") : "";

    // Slack section text caps at 3000 chars; leave headroom for headers.
    const body = `${errName}: ${errMsg}${stack ? `\n\n\`\`\`${stack.slice(0, 2400)}\`\`\`` : ""}`;

    await notifySlack({
      channel: "critical-errors",
      title: extra?.source ? `Error in ${extra.source}` : "Critical Error",
      message: body,
      context: {
        ...toSlackContextRecord(ctx, { includeUserAgent: true }),
        ...(extra ?? {}),
      },
    });
  } catch (reportErr) {
    // Last-resort: log to stderr. We never throw from here.
    console.error("[reportCriticalError] failed to deliver:", reportErr);
  }
}
