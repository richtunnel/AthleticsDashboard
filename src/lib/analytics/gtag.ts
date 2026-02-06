export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-M0V1C7PQ3L";

export const pageview = (url: string) => {
  window.gtag?.("event", "page_view", {
    page_path: url,
    send_to: GA_MEASUREMENT_ID,
  });
};

export const event = ({ action, category, label, value }: { action: string; category?: string; label?: string; value?: number }) => {
  window.gtag?.("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
};
