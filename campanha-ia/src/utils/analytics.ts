type AnalyticsParams = Record<string, unknown>;

interface AnalyticsWindow extends Window {
  gtag?: (cmd: "event", name: string, params?: AnalyticsParams) => void;
  fbq?: (cmd: "track" | "trackCustom", name: string, params?: AnalyticsParams) => void;
}

export const trackEvent = (eventName: string, params?: AnalyticsParams) => {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  // Dispatch para o GTags se existir (Google Analytics 4 / Google Ads)
  if (typeof w.gtag !== "undefined") {
    w.gtag("event", eventName, params);
  }
  // Dispatch fbq se existir (Meta Pixel)
  if (typeof w.fbq !== "undefined") {
    if (eventName === "purchase") {
      w.fbq("track", "Purchase", params);
    } else {
      w.fbq("trackCustom", eventName, params);
    }
  }
};

export const trackCtaClick = (location: string, label: string) => {
  trackEvent("cta_click", {
    click_location: location,
    click_label: label,
  });
};

export const trackCheckoutStart = (planName: string, value: number) => {
  trackEvent("begin_checkout", {
    currency: "BRL",
    value: value,
    items: [
      {
        item_name: planName,
        price: value,
      }
    ]
  });
};
