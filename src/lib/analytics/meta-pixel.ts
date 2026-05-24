/**
 * Meta Pixel — browser-side helpers.
 *
 * Only call these from Client Components or event handlers.
 * Do NOT import this file in Server Components or API routes.
 */

export const PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ?? "";

declare global {
  interface Window {
    fbq: ((...args: any[]) => void) & {
      callMethod?: (...args: any[]) => void;
      queue?: any[];
      loaded?: boolean;
      version?: string;
    };
    _fbq?: any;
  }
}

/**
 * Fire a standard pixel event.
 *
 * @param eventName  Meta standard event name (e.g. "Purchase", "CompleteRegistration")
 * @param params     Event parameters (e.g. { currency: "USD", value: 29.99 })
 * @param eventId    Dedup ID — must match the event_id sent to CAPI for the same event
 */
export function pixelTrack(
  eventName: string,
  params?: Record<string, any>,
  eventId?: string
) {
  if (typeof window === "undefined" || !window.fbq) return;
  const trackOptions = eventId ? { eventID: eventId } : {};
  window.fbq("track", eventName, params ?? {}, trackOptions);
}

/** Track a page view (called by AnalyticsProvider on route change). */
export function pixelPageView() {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "PageView");
}
