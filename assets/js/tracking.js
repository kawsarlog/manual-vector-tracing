/**
 * Conversion tracking placeholders — Manual Vector Tracing
 *
 * HOW TO WIRE REAL IDs LATER (do not invent Measurement / conversion IDs here):
 *
 * 1) Google Analytics 4 (GA4)
 *    - Admin → Data Streams → your web stream → copy Measurement ID (G-XXXXXXXX)
 *    - Paste the gtag snippet in every page <head> (or via GTM), e.g.:
 *
 *      <!-- Replace G-XXXXXXXX with your real GA4 Measurement ID -->
 *      <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>
 *      <script>
 *        window.dataLayer = window.dataLayer || [];
 *        function gtag(){ dataLayer.push(arguments); }
 *        gtag("js", new Date());
 *        gtag("config", "G-XXXXXXXX");
 *      </script>
 *
 * 2) Google Ads conversions
 *    - Google Ads → Goals → Conversions → create/select conversion → Tag setup
 *    - After gtag is loaded, send conversions from trackEvent (generate_lead), e.g.:
 *
 *      // Inside trackEvent when name === "generate_lead" (replace AW-…/label):
 *      // gtag("event", "conversion", { send_to: "AW-XXXXXXXXXX/XXXXXXXXXXXXX" });
 *
 * 3) Google Tag Manager (optional)
 *    - This file already pushes to window.dataLayer; map custom events in GTM
 *      (event names: generate_lead, cta_click).
 *
 * Debug: set window.__TRACKING_VERBOSE__ = true in the browser console to log events.
 */
(function () {
  window.dataLayer = window.dataLayer || [];

  /**
   * @param {string} name - Event name (e.g. generate_lead, cta_click)
   * @param {Record<string, unknown>} [payload]
   */
  function trackEvent(name, payload) {
    const data = Object.assign({ event: name }, payload || {});
    window.dataLayer.push(data);
    if (window.__TRACKING_VERBOSE__) {
      console.info("[trackEvent]", name, payload || {});
    }
  }

  window.trackEvent = trackEvent;

  function bindCtaClicks() {
    const nodes = document.querySelectorAll(
      [
        "a.header-cta",
        ".cta-band a.btn",
        ".hero__actions a.btn--primary",
        ".footer-contact a.btn[href*='contact']",
        "a.btn--primary[href*='contact']",
        "a.btn--white[href*='contact']",
        "a.btn--dark[href*='contact']",
      ].join(",")
    );

    nodes.forEach((el) => {
      if (el.dataset.trackBound === "1") return;
      el.dataset.trackBound = "1";
      el.addEventListener("click", () => {
        trackEvent("cta_click", {
          label: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          href: el.getAttribute("href") || "",
          location: el.closest("header")
            ? "header"
            : el.closest(".cta-band")
              ? "cta_band"
              : el.closest(".hero")
                ? "hero"
                : el.closest("footer")
                  ? "footer"
                  : "page",
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindCtaClicks);
  } else {
    bindCtaClicks();
  }
})();
