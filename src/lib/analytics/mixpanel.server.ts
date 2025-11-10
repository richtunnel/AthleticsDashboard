// /lib/mixpanelServer.ts
import mixpanel from "mixpanel";

const serviceSecret = process.env.MIXPANEL_SERVICE_SECRET;
if (!serviceSecret) throw new Error("Missing MIXPANEL_SERVICE_SECRET");

export const mixpanelServer = mixpanel.init(serviceSecret);

export const trackServerEvent = (event: string, properties?: Record<string, any>) => {
  mixpanelServer.track(event, properties || {});
};
