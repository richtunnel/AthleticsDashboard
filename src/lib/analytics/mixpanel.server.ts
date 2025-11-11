// /lib/mixpanelServer.ts
import mixpanel from "mixpanel";

const serviceSecret = process.env.MIXPANEL_SERVICE_SECRET;

if (!serviceSecret) {
  console.warn("MIXPANEL_SERVICE_SECRET not configured - server-side tracking disabled");
}

export const mixpanelServer = serviceSecret ? mixpanel.init(serviceSecret) : null;

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
