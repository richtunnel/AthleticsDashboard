/**
 * POST /api/meta/conversions
 *
 * Thin CAPI proxy called by client-side meta-events helpers.
 * The server enriches the event with the real client IP and user-agent
 * (which are more accurate here than what the browser reports) and
 * forwards to Meta's Conversions API.
 *
 * This is a public route — no auth required — because it only relays
 * analytics events to Meta, and the pixel_id/access_token are server-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendCapiEvent } from "@/lib/analytics/meta-capi";
import { extractRequestMetadataFromHeaders } from "@/lib/utils/requestMetadata";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventName, eventId, sourceUrl, userData, customData } = body;

    if (!eventName || !eventId) {
      return NextResponse.json(
        { ok: false, error: "eventName and eventId are required" },
        { status: 400 }
      );
    }

    // Server reads the real IP / UA from headers — more reliable than client-reported
    const meta = extractRequestMetadataFromHeaders(req.headers);

    await sendCapiEvent({
      eventName,
      eventId,
      sourceUrl,
      userData: {
        ...userData,
        ip: meta.ip ?? userData?.ip ?? null,
        userAgent: meta.userAgent ?? userData?.userAgent ?? null,
      },
      customData,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Meta Conversions Proxy]", err?.message);
    // Return 200 even on error — analytics must never cause client retries
    return NextResponse.json({ ok: false });
  }
}
