"use client";

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const isDevelopment = process.env.NODE_ENV === "development";

let initialized = false;
let initAttempted = false;

type MixpanelConfig = Parameters<typeof mixpanel.init>[1];
type MixpanelEventProperties = Parameters<typeof mixpanel.track>[1];

function canUseMixpanel() {
  return typeof window !== "undefined" && Boolean(MIXPANEL_TOKEN);
}

export function initMixpanel(config?: MixpanelConfig) {
  if (initialized) {
    return true;
  }

  if (initAttempted && !canUseMixpanel()) {
    return false;
  }

  initAttempted = true;

  if (!canUseMixpanel()) {
    if (isDevelopment && typeof window !== "undefined") {
      console.warn("Mixpanel token not provided. Analytics are disabled.");
    }
    return false;
  }

  mixpanel.init(MIXPANEL_TOKEN as string, {
    debug: isDevelopment,
    track_pageview: false,
    persistence: "localStorage",
    ...config,
  });

  initialized = true;
  return true;
}

export function trackMixpanelEvent(eventName: string, properties?: MixpanelEventProperties) {
  if (typeof window === "undefined") {
    return;
  }

  if (!initialized && !initMixpanel()) {
    return;
  }

  mixpanel.track(eventName, properties);
}

export function trackMixpanelPageView(path: string, properties?: MixpanelEventProperties) {
  const eventProperties = properties ? { path, ...properties } : { path };
  trackMixpanelEvent("Page View", eventProperties);
}

export function resetMixpanel() {
  if (typeof window === "undefined" || !initialized) {
    return;
  }

  mixpanel.reset();
  initialized = false;
  initAttempted = false;
}
