import { NextRequest, NextResponse } from "next/server";
import { disableOverdueAccounts } from "@/lib/services/account-disable.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron job to automatically disable accounts with overdue payments (>48 hours)
 * This should be scheduled to run hourly or daily
 */
export async function POST(req: NextRequest) {
  const runStartedAt = new Date();

  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = extractSecret(req);
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[DisableOverdueAccounts] Job started at ${runStartedAt.toISOString()}`);

  try {
    const result = await disableOverdueAccounts();
    
    const durationMs = Date.now() - runStartedAt.getTime();
    console.log(`[DisableOverdueAccounts] Job completed in ${durationMs}ms. Disabled: ${result.disabled}`);

    return NextResponse.json(
      {
        runAt: runStartedAt.toISOString(),
        durationMs,
        accountsDisabled: result.disabled,
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    const durationMs = Date.now() - runStartedAt.getTime();
    console.error("[DisableOverdueAccounts] Job failed:", error);

    return NextResponse.json(
      {
        runAt: runStartedAt.toISOString(),
        durationMs,
        accountsDisabled: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function extractSecret(req: NextRequest) {
  const header = req.headers.get("x-cron-secret")?.trim();
  if (header) {
    return header;
  }

  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return authorization;
}
