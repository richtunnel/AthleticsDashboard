import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN! || "";

let isInitialized = false;

export const initMixpanel = () => {
  if (!MIXPANEL_TOKEN) {
    console.warn("Mixpanel token missing");
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
      ignore_dnt: false,
    });
    isInitialized = true;
  } catch (err) {
    console.error("Mixpanel init error:", err);
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
    console.error("Mixpanel track error:", err);
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
    console.error("Mixpanel identify error:", err);
  }
};

export const resetMixpanel = () => {
  try {
    if (isInitialized) {
      mixpanel.reset();
    }
  } catch (err) {
    console.error("Mixpanel reset error:", err);
  }
};
