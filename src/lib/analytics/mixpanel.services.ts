import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN! || "";

export const initMixpanel = () => {
  if (!MIXPANEL_TOKEN) {
    console.warn("Mixpanel token missing");
    return;
  }

  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === "development",
    track_pageview: true,
    autocapture: true,
    record_sessions_percent: 100,
  });
};

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  try {
    mixpanel.track(event, properties);
  } catch (err) {
    console.error("Mixpanel track error:", err);
  }
};
