(() => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const stage = document.querySelector(".ba__stage");
  if (stage) {
    const before = stage.querySelector(".ba__layer--before");
    const beforeImg = before?.querySelector(".ba__photo");
    const handle = stage.querySelector(".ba__handle");
    const range = stage.querySelector(".ba__range");

    const syncImgWidth = () => {
      stage.style.setProperty("--ba-stage-w", `${stage.offsetWidth}px`);
      if (beforeImg) beforeImg.style.width = `${stage.offsetWidth}px`;
    };

    const setPos = (pct) => {
      const value = Math.min(100, Math.max(0, pct));
      before.style.width = `${value}%`;
      handle.style.left = `${value}%`;
      if (range) range.value = String(Math.round(value));
    };

    if (range) {
      range.addEventListener("input", () => setPos(Number(range.value)));
    }

    const pointerMove = (clientX) => {
      const rect = stage.getBoundingClientRect();
      setPos(((clientX - rect.left) / rect.width) * 100);
    };

    stage.addEventListener("pointerdown", (e) => {
      if (e.target === range) return;
      stage.setPointerCapture(e.pointerId);
      pointerMove(e.clientX);
    });
    stage.addEventListener("pointermove", (e) => {
      if (stage.hasPointerCapture(e.pointerId)) pointerMove(e.clientX);
    });
    stage.addEventListener("pointerup", (e) => {
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    });
    stage.addEventListener("pointercancel", (e) => {
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    });

    window.addEventListener("resize", syncImgWidth);
    syncImgWidth();
    setPos(52);
  }

  const dropzone = document.querySelector(".dropzone");
  const fileInput = document.querySelector("#file-input");
  if (dropzone && fileInput) {
    const setName = (files) => {
      if (!files?.length) return;
      dropzone.querySelector("strong").textContent = files[0].name;
      dropzone.querySelector("span").textContent =
        "Selected — attach this file in WhatsApp after you tap Get Free Quote";
    };
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("is-drag");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-drag");
      if (e.dataTransfer?.files?.length) {
        fileInput.files = e.dataTransfer.files;
        setName(e.dataTransfer.files);
      }
    });
    fileInput.addEventListener("change", () => setName(fileInput.files));
  }

  /* Quote form → WhatsApp (prefilled) with mailto fallback. Files can’t go via wa.me. */
  const form = document.querySelector("[data-quote-form]");
  if (form) {
    const WA_E164 = "8801685844099";
    const QUOTE_EMAIL = "hello@manualvectortracing.com";
    const escapeHtml = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = form.querySelector("[data-form-status]");
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const use = String(fd.get("use") || "").trim();
      const deadline = String(fd.get("deadline") || "").trim();
      const details = String(fd.get("details") || "").trim();
      const picked = form.querySelector("#file-input")?.files?.[0];
      const fileName = picked?.name || "";

      const showStatus = (html, ok = true) => {
        if (!note) return;
        note.hidden = false;
        note.classList.toggle("form-status--ok", ok);
        note.classList.toggle("form-status--err", !ok);
        note.innerHTML = html;
      };

      if (!name || !email) {
        showStatus("Please enter your name and email so we can reply.", false);
        return;
      }

      const lines = [
        "Free vector quote request",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Intended use: ${use || "—"}`,
        `Deadline: ${deadline || "—"}`,
        `Details: ${details || "—"}`,
      ];
      if (fileName) {
        lines.push(`Selected file (please attach in chat): ${fileName}`);
      }
      const body = lines.join("\n");

      if (typeof window.trackEvent === "function") {
        window.trackEvent("generate_lead", {
          method: "quote_form",
          use: use || undefined,
          has_file: Boolean(fileName),
        });
      }

      const waUrl = `https://wa.me/${WA_E164}?text=${encodeURIComponent(body)}`;
      const mailtoUrl =
        `mailto:${QUOTE_EMAIL}` +
        `?subject=${encodeURIComponent("Free vector quote request")}` +
        `&body=${encodeURIComponent(body)}`;

      const attachHint = fileName
        ? ` Attach <strong>${escapeHtml(fileName)}</strong> in the WhatsApp chat — file upload can’t travel through the link.`
        : ` After chat opens, attach your logo file there (files can’t travel through the WhatsApp link).`;

      let opened = null;
      try {
        opened = window.open(waUrl, "_blank", "noopener,noreferrer");
      } catch (_) {
        opened = null;
      }

      if (!opened) {
        window.location.href = mailtoUrl;
        showStatus(
          `WhatsApp didn’t open (often blocked by the browser). Your email app should open with the same details — or <a href="${waUrl}" target="_blank" rel="noopener noreferrer">open WhatsApp manually</a>.${attachHint}`,
          true
        );
        return;
      }

      showStatus(
        `Thanks${name ? `, ${escapeHtml(name)}` : ""} — WhatsApp is opening with your quote details.${attachHint}` +
          ` If nothing opens, <a href="${mailtoUrl}">email us instead</a>.`,
        true
      );
    });
  }

  /* Modest floating WhatsApp control (P1 contact reachability; site blue + WA icon) */
  if (!document.querySelector(".wa-float")) {
    const float = document.createElement("a");
    float.className = "wa-float";
    float.href = "https://wa.me/8801685844099";
    float.target = "_blank";
    float.rel = "noopener noreferrer";
    float.setAttribute("aria-label", "Chat on WhatsApp");
    float.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/><path d="M12.04 2C6.5 2 2.02 6.48 2.02 12c0 1.85.5 3.58 1.38 5.07L2 22l5.08-1.33A9.96 9.96 0 0 0 12.04 22C17.56 22 22 17.52 22 12S17.56 2 12.04 2zm0 18.15c-1.67 0-3.22-.5-4.52-1.35l-.32-.2-3.01.79.8-2.94-.21-.33a8.12 8.12 0 0 1-1.25-4.32c0-4.5 3.66-8.15 8.17-8.15 4.5 0 8.15 3.65 8.15 8.15 0 4.5-3.65 8.15-8.15 8.15z"/></svg>';
    float.addEventListener("click", () => {
      if (typeof window.trackEvent === "function") {
        window.trackEvent("cta_click", { label: "WhatsApp float", href: float.href, location: "float" });
      }
    });
    document.body.appendChild(float);
  }

  if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    const items = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* Scroll spy: highlight in-page nav links on the home page only */
  const isHomePage = (() => {
    const file = (location.pathname.replace(/\\/g, "/").split("/").pop() || "").toLowerCase();
    return file === "" || file === "index.html" || file === "index.htm";
  })();

  if (isHomePage && nav) {
    const spyTargets = [
      { id: "top", test: (href) => /^(?:index\.html)?(?:#(?:top)?)?$|^\/$|^#$|^index\.html#top$/i.test(href.trim()) },
      { id: "why", test: () => false },
      { id: "how", test: (href) => /#how\b/i.test(href) },
      { id: "portfolio", test: (href) => /#portfolio\b/i.test(href) },
      { id: "industries", test: () => false },
      { id: "reviews", test: (href) => /#reviews\b/i.test(href) },
    ];

    const spyLinks = [...nav.querySelectorAll("a")].filter((a) => {
      const href = a.getAttribute("href") || "";
      return spyTargets.some((t) => t.test(href));
    });

    const elements = spyTargets
      .map((t) => {
        const el = document.getElementById(t.id);
        return el ? { ...t, el } : null;
      })
      .filter(Boolean);

    if (spyLinks.length && elements.length) {
      const setActiveSection = (activeId) => {
        spyLinks.forEach((link) => {
          const href = link.getAttribute("href") || "";
          const match = spyTargets.find((t) => t.id === activeId && t.test(href));
          if (match) {
            link.setAttribute("aria-current", "page");
            link.classList.add("is-active");
          } else {
            link.removeAttribute("aria-current");
            link.classList.remove("is-active");
          }
        });
      };

      const visible = new Map();
      let currentId = "top";
      const headerOffset = () => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue("--header-h").trim();
        const n = Number.parseFloat(raw);
        return Number.isFinite(n) ? n : 76;
      };

      const resolveLinkedId = (id) => {
        const linkedIds = new Set(
          spyTargets
            .filter((t) => spyLinks.some((a) => t.test(a.getAttribute("href") || "")))
            .map((t) => t.id)
        );
        if (linkedIds.has(id)) return id;
        const order = elements.map((e) => e.id);
        const idx = order.indexOf(id);
        for (let i = idx; i >= 0; i--) {
          if (linkedIds.has(order[i])) return order[i];
        }
        return "top";
      };

      const spyIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
          });
          let bestId = currentId;
          let bestRatio = 0;
          elements.forEach(({ id }) => {
            const ratio = visible.get(id) || 0;
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          });
          if (bestRatio > 0) {
            currentId = resolveLinkedId(bestId);
            setActiveSection(currentId);
          }
        },
        {
          threshold: [0, 0.15, 0.35, 0.55, 0.75],
          rootMargin: `-${headerOffset()}px 0px -45% 0px`,
        }
      );

      elements.forEach(({ el }) => spyIo.observe(el));
      setActiveSection(currentId);
    }
  }
})();
