/**
 * Conversion / GA4 + dataLayer tracking — Manual Vector Tracing
 *
 * GA4 measurement ID is loaded via gtag.js on each page (G-SYKYBT4W8J).
 * Events are also pushed to dataLayer for GTM if a container is added later.
 *
 *   Primary (Ads primary conversion candidates):
 *     - quote_submit_success
 *     - generate_lead
 *
 *   Secondary:
 *     - quote_form_start
 *     - cta_get_free_quote_click
 *     - whatsapp_click
 *     - email_click
 *     - phone_click
 *
 * GTM bootstrap (optional, in addition to GA4):
 *   Set either:  window.MVT_GTM_ID = 'GTM-XXXXXXX';
 *   or:          <meta name="gtm-id" content="GTM-XXXXXXX">
 *
 * Debug: window.__TRACKING_VERBOSE__ = true
 */
(function () {
  window.dataLayer = window.dataLayer || [];
  /** @type {string} Set later to a real GTM container ID, e.g. 'GTM-XXXXXXX' */
  window.MVT_GTM_ID = window.MVT_GTM_ID || "";

  /**
   * GA4 event params must not include raw email/phone.
   * @param {Record<string, unknown>} [payload]
   */
  function gtagSafeParams(payload) {
    const out = Object.assign({}, payload || {});
    delete out.email;
    delete out.phone;
    delete out.user_data;
    return out;
  }

  /**
   * @param {string} name
   * @param {Record<string, unknown>} [payload]
   */
  function trackEvent(name, payload) {
    const data = Object.assign({ event: name }, payload || {});
    window.dataLayer.push(data);
    if (typeof window.gtag === "function") {
      window.gtag("event", name, gtagSafeParams(payload));
    }
    if (window.__TRACKING_VERBOSE__) {
      console.info("[trackEvent]", name, payload || {});
    }
  }

  window.trackEvent = trackEvent;

  function resolveGtmId() {
    const fromWindow = String(window.MVT_GTM_ID || "").trim();
    if (fromWindow) return fromWindow;
    const meta = document.querySelector('meta[name="gtm-id"]');
    const fromMeta = meta && String(meta.getAttribute("content") || "").trim();
    return fromMeta || "";
  }

  function loadGtm(containerId) {
    if (!containerId || window.__MVT_GTM_LOADED__) return;
    window.__MVT_GTM_LOADED__ = true;
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    const first = document.getElementsByTagName("script")[0];
    const s = document.createElement("script");
    s.async = true;
    s.src =
      "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(containerId);
    if (first && first.parentNode) {
      first.parentNode.insertBefore(s, first);
    } else {
      document.head.appendChild(s);
    }
  }

  function ctaLocation(el) {
    if (el.closest("header")) return "header";
    if (el.closest(".cta-band")) return "cta_band";
    if (el.closest(".hero")) return "hero";
    if (el.closest("footer")) return "footer";
    if (el.closest(".pricing") || el.closest(".price")) return "pricing";
    return "page";
  }

  function isPrimaryQuoteCta(a) {
    if (!a || a.tagName !== "A") return false;
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (!href.includes("contact")) return false;
    if (a.classList.contains("header-cta")) return true;
    if (a.closest(".cta-band") && a.classList.contains("btn")) return true;
    if (
      a.classList.contains("btn--primary") ||
      a.classList.contains("btn--white") ||
      a.classList.contains("btn--dark")
    ) {
      return true;
    }
    return false;
  }

  function bindOutboundClicks() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;

      const href = a.getAttribute("href") || "";

      if (/^mailto:/i.test(href)) {
        trackEvent("email_click", {
          href: href.slice(0, 160),
          location: ctaLocation(a),
        });
        return;
      }

      if (/^tel:/i.test(href)) {
        trackEvent("phone_click", {
          href: href.slice(0, 80),
          location: ctaLocation(a),
        });
        return;
      }

      if (
        a.classList.contains("wa-float") ||
        /wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/send/i.test(href)
      ) {
        trackEvent("whatsapp_click", {
          href: href.split("?")[0].slice(0, 120),
          location: a.classList.contains("wa-float") ? "float" : ctaLocation(a),
        });
        return;
      }

      if (isPrimaryQuoteCta(a)) {
        trackEvent("cta_get_free_quote_click", {
          label: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          href: href.slice(0, 120),
          location: ctaLocation(a),
        });
      }
    });
  }

  function bindQuoteFormStart() {
    const form = document.querySelector("[data-quote-form]");
    if (!form) return;

    let started = false;
    const markStart = () => {
      if (started) return;
      started = true;
      trackEvent("quote_form_start", { form_name: "contact_quote" });
    };

    form.addEventListener("focusin", markStart);
    form.addEventListener("change", markStart);
  }

  function init() {
    const gtmId = resolveGtmId();
    if (gtmId) loadGtm(gtmId);

    bindOutboundClicks();
    bindQuoteFormStart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
