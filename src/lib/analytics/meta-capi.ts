/**
 * Meta Conversions API (CAPI) — server-side helper.
 *
 * Required env vars:
 *   NEXT_PUBLIC_FACEBOOK_PIXEL_ID   — your pixel ID (e.g. 4286454345000729)
 *   FACEBOOK_CAPI_ACCESS_TOKEN      — system user token from Meta Events Manager
 *
 * Optional:
 *   META_TEST_EVENT_CODE            — e.g. "TEST12345", only for staging/QA
 */

import crypto from "crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
const CAPI_TOKEN = process.env.FACEBOOK_CAPI_ACCESS_TOKEN;
const CAPI_ENDPOINT = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://opletics.com").replace(/\/$/, "");

/** SHA-256 hash required by Meta for PII fields. */
function hash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface MetaUserData {
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;  // Value of _fbp cookie
  fbc?: string | null;  // Value of _fbc cookie
  country?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface MetaCapiEvent {
  /** Meta standard event name, e.g. "Purchase" */
  eventName: string;
  /**
   * Must be identical to the eventID passed to fbq("track", ..., {eventID})
   * so Meta can deduplicate browser + server events.
   */
  eventId: string;
  /** Full page URL where the conversion happened. */
  sourceUrl?: string;
  userData: MetaUserData;
  /** Event-specific data (value, currency, content_name, etc.) */
  customData?: Record<string, any>;
}

export async function sendCapiEvent(payload: MetaCapiEvent): Promise<void> {
  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.warn(
      "[Meta CAPI] NEXT_PUBLIC_FACEBOOK_PIXEL_ID or FACEBOOK_CAPI_ACCESS_TOKEN not set — skipping"
    );
    return;
  }

  // Build user_data — hash all PII per Meta requirements
  const ud: Record<string, any> = {};
  if (payload.userData.ip) ud.client_ip_address = payload.userData.ip;
  if (payload.userData.userAgent) ud.client_user_agent = payload.userData.userAgent;
  if (payload.userData.fbp) ud.fbp = payload.userData.fbp;
  if (payload.userData.fbc) ud.fbc = payload.userData.fbc;
  if (payload.userData.email) ud.em = hash(payload.userData.email);
  if (payload.userData.country) ud.country = hash(payload.userData.country);
  if (payload.userData.city) ud.ct = hash(payload.userData.city);
  if (payload.userData.state) ud.st = hash(payload.userData.state);

  const body: Record<string, any> = {
    data: [
      {
        event_name: payload.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: payload.eventId,
        event_source_url: payload.sourceUrl ?? SITE_URL,
        action_source: "website",
        user_data: ud,
        ...(payload.customData && Object.keys(payload.customData).length > 0
          ? { custom_data: payload.customData }
          : {}),
      },
    ],
  };

  // Attach test event code if set (only for non-production testing)
  const testCode = process.env.META_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(`${CAPI_ENDPOINT}?access_token=${CAPI_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Meta CAPI] Error response", {
        status: res.status,
        event: payload.eventName,
        body: text.slice(0, 500),
      });
    }
  } catch (err) {
    // Never throw — analytics must never break the app
    console.error("[Meta CAPI] Network error", err);
  }
}
