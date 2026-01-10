import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN! || "";

let isInitialized = false;

export const initMixpanel = () => {
  if (!MIXPANEL_TOKEN) {
    return;
  }

  if (isInitialized) {
    return;
  }

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === "development",
      track_pageview: "full-url",
      persistence: "localStorage",
      record_sessions_percent: 1, // Session Replay enabled, recording 1% of all sessions
      record_heatmap_data: true, // Enable Heatmap data collection
      ignore_dnt: false,
    });
    isInitialized = true;
  } catch (err) {
    // Mixpanel initialization failed - analytics will not be available
  }
};

export const trackEvent = (event: string, properties?: Record<string, any>) => {
  try {
    if (!isInitialized) {
      initMixpanel();
    }
    if (isInitialized) {
      mixpanel.track(event, properties);
    }
  } catch (err) {
    // Analytics event tracking failed
  }
};

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  try {
    if (!isInitialized) {
      initMixpanel();
    }
    if (isInitialized) {
      mixpanel.identify(userId);
      if (properties) {
        mixpanel.people.set(properties);
      }
    }
  } catch (err) {
    // Analytics user identification failed
  }
};

export const resetMixpanel = () => {
  try {
    if (isInitialized) {
      mixpanel.reset();
    }
  } catch (err) {
    // Mixpanel reset failed
  }
};
