"use client";

/**
 * Meta event helpers — for use in Client Components only.
 *
 * Each helper:
 *   1. Fires the browser pixel (fbq) immediately
 *   2. Forwards the same event to the server CAPI proxy (/api/meta/conversions)
 *      so Meta receives a server-quality signal with the real IP/user-agent.
 *   Both events share the same event_id so Meta deduplicates them.
 */

import { pixelTrack } from "./meta-pixel";

/** Read a cookie value by name. */
function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Generate a dedup ID (UUID v4 via Web Crypto, no external dependency). */
function newEventId(): string {
  return crypto.randomUUID();
}

async function proxyCapiEvent(payload: {
  eventName: string;
  eventId: string;
  sourceUrl: string;
  userData: Record<string, any>;
  customData?: Record<string, any>;
}) {
  try {
    // Fire-and-forget — never await in a user flow
    fetch("/api/meta/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Swallow — analytics must never break UX
  }
}

function basePayload(eventName: string, customData?: Record<string, any>) {
  const eventId = newEventId();
  const sourceUrl = typeof window !== "undefined" ? window.location.href : "";
  return { eventName, eventId, sourceUrl, customData };
}

// ─── Standard events ──────────────────────────────────────────────────────────

export function trackViewContent(contentName?: string) {
  const { eventName, eventId, sourceUrl } = basePayload("ViewContent");
  const params = contentName ? { content_name: contentName } : {};
  pixelTrack(eventName, params, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
    customData: params,
  });
}

export function trackCompleteRegistration(planName?: string) {
  const { eventName, eventId, sourceUrl } = basePayload("CompleteRegistration");
  const params = planName ? { content_name: planName } : {};
  pixelTrack(eventName, params, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
    customData: params,
  });
}

export function trackInitiateCheckout(value?: number, currency = "USD") {
  const { eventName, eventId, sourceUrl } = basePayload("InitiateCheckout");
  const params: Record<string, any> = { currency };
  if (value !== undefined) params.value = value;
  pixelTrack(eventName, params, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
    customData: params,
  });
}

export function trackAddPaymentInfo() {
  const { eventName, eventId, sourceUrl } = basePayload("AddPaymentInfo");
  pixelTrack(eventName, {}, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
  });
}

export function trackLead(contentName?: string) {
  const { eventName, eventId, sourceUrl } = basePayload("Lead");
  const params = contentName ? { content_name: contentName } : {};
  pixelTrack(eventName, params, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
    customData: params,
  });
}

export function trackSubscribe() {
  const { eventName, eventId, sourceUrl } = basePayload("Subscribe");
  pixelTrack(eventName, {}, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
  });
}

export function trackContact() {
  const { eventName, eventId, sourceUrl } = basePayload("Contact");
  pixelTrack(eventName, {}, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
  });
}

export function trackSchedule() {
  const { eventName, eventId, sourceUrl } = basePayload("Schedule");
  pixelTrack(eventName, {}, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
  });
}

export function trackStartTrial() {
  const { eventName, eventId, sourceUrl } = basePayload("StartTrial");
  pixelTrack(eventName, {}, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
  });
}

/**
 * Purchase is fired server-side from the Stripe webhook (most reliable).
 * This client helper exists as a fallback for checkout success pages.
 */
export function trackPurchase(value: number, currency = "USD") {
  const { eventName, eventId, sourceUrl } = basePayload("Purchase");
  const params = { value, currency };
  pixelTrack(eventName, params, eventId);
  proxyCapiEvent({
    eventName, eventId, sourceUrl,
    userData: { fbp: getCookie("_fbp"), fbc: getCookie("_fbc") },
    customData: params,
  });
}
