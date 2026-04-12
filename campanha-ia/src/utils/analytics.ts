export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== "undefined") {
    // Dispatch para o GTags se existir (Google Analytics 4 / Google Ads)
    if (typeof (window as any).gtag !== "undefined") {
      (window as any).gtag("event", eventName, params);
    }
    // Dispatch fbq se existir (Meta Pixel)
    if (typeof (window as any).fbq !== "undefined") {
      if (eventName === "purchase") {
        (window as any).fbq("track", "Purchase", params);
      } else {
        (window as any).fbq("trackCustom", eventName, params);
      }
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
