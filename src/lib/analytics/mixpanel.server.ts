// /lib/mixpanelServer.ts
import mixpanel from "mixpanel";

// The mixpanel Node.js package needs the project token (same token used client-side).
// MIXPANEL_API_SECRET and the service account credentials are for the Data Export /
// JQL APIs — they are NOT used here for event tracking.
const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

if (!token) {
  console.warn("NEXT_PUBLIC_MIXPANEL_TOKEN not configured - server-side tracking disabled");
}

export const mixpanelServer = token ? mixpanel.init(token) : null;

export const trackServerEvent = (event: string, properties?: Record<string, any>) => {
  try {
    if (mixpanelServer) {
      mixpanelServer.track(event, properties || {});
    }
  } catch (err) {
    console.error("Mixpanel server track error:", err);
  }
};

export const identifyServerUser = (userId: string, properties?: Record<string, any>) => {
  try {
    if (mixpanelServer && properties) {
      mixpanelServer.people.set(userId, properties);
    }
  } catch (err) {
    console.error("Mixpanel server identify error:", err);
  }
};
