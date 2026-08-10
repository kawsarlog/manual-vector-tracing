(() => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    const setMenuOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    toggle.addEventListener("click", () => {
      setMenuOpen(!nav.classList.contains("is-open"));
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    });
    document.addEventListener("click", (e) => {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      setMenuOpen(false);
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

  const MAX_QUOTE_FILES = 5;
  /** Prefer attaching images/PDFs under this size each (~1.5 MB). */
  const MAX_ATTACH_FILE_BYTES = Math.floor(1.5 * 1024 * 1024);
  /** Keep total JSON body under Vercel hobby limit (~4.5 MB). Base64 adds ~33%. */
  const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
  const TOO_LARGE_NOTE = "too large to attach — use WhatsApp";
  let selectedFiles = [];
  const dropzone = document.querySelector(".dropzone");
  const fileInput = document.querySelector("#file-input");
  const fileListEl = document.querySelector("[data-file-list]");
  const fileLimitMsg = document.querySelector("[data-file-limit-msg]");

  const formatFileSize = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  };

  const stripDataUrlPrefix = (value) => {
    const s = String(value || "");
    const comma = s.indexOf(",");
    if (s.startsWith("data:") && comma !== -1) return s.slice(comma + 1);
    return s;
  };

  /**
   * Read a File as raw base64 (no data: URL prefix).
   * @param {File} file
   * @returns {Promise<string>}
   */
  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(stripDataUrlPrefix(reader.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  /**
   * Build files payload for /api/contact — attach when size budget allows.
   * @param {File[]} files
   * @returns {Promise<{ files: Array<{name:string,type:string,size:number,contentBase64?:string,note?:string}>, skippedLarge: number }>}
   */
  const buildFilesPayload = async (files) => {
    const list = (files || []).slice(0, MAX_QUOTE_FILES);
    const out = [];
    let budget = MAX_PAYLOAD_BYTES - 12 * 1024; /* leave room for text fields */
    let skippedLarge = 0;

    for (const file of list) {
      const entry = {
        name: file.name,
        type: file.type || "",
        size: file.size,
      };

      if (!file.size || file.size > MAX_ATTACH_FILE_BYTES) {
        entry.note = TOO_LARGE_NOTE;
        skippedLarge += 1;
        out.push(entry);
        continue;
      }

      try {
        const contentBase64 = await readFileAsBase64(file);
        /* Base64 string length ≈ bytes in the JSON body for this field */
        const encodedBytes = contentBase64.length;
        if (encodedBytes > budget) {
          entry.note = TOO_LARGE_NOTE;
          skippedLarge += 1;
          out.push(entry);
          continue;
        }
        entry.contentBase64 = contentBase64;
        budget -= encodedBytes;
      } catch (_) {
        entry.note = TOO_LARGE_NOTE;
        skippedLarge += 1;
      }
      out.push(entry);
    }

    return { files: out, skippedLarge };
  };

  const syncFileInput = () => {
    if (!fileInput) return;
    const dt = new DataTransfer();
    selectedFiles.forEach((file) => dt.items.add(file));
    fileInput.files = dt.files;
  };

  const setFileLimitMessage = (message) => {
    if (!fileLimitMsg) return;
    if (message) {
      fileLimitMsg.hidden = false;
      fileLimitMsg.textContent = message;
    } else {
      fileLimitMsg.hidden = true;
      fileLimitMsg.textContent = "";
    }
  };

  const updateDropzoneCopy = () => {
    if (!dropzone) return;
    const title = dropzone.querySelector("strong");
    const hint = dropzone.querySelector("span");
    if (!title || !hint) return;
    if (!selectedFiles.length) {
      title.textContent = "JPG, PNG, PDF, screenshots & scans accepted";
      hint.textContent =
        "Have an AI, EPS, or SVG file that needs cleanup? You can upload that too.";
      return;
    }
    const count = selectedFiles.length;
    title.textContent =
      count === 1 ? "1 file selected" : `${count} files selected (max ${MAX_QUOTE_FILES})`;
    hint.textContent =
      "Files email as attachments when under size limits (else use WhatsApp)";
  };

  const renderSelectedFiles = () => {
    updateDropzoneCopy();
    if (!fileListEl) return;
    fileListEl.innerHTML = "";
    if (!selectedFiles.length) {
      fileListEl.hidden = true;
      return;
    }
    fileListEl.hidden = false;
    selectedFiles.forEach((file, index) => {
      const li = document.createElement("li");
      li.className = "file-list__item";

      const meta = document.createElement("div");
      meta.className = "file-list__meta";

      const nameEl = document.createElement("span");
      nameEl.className = "file-list__name";
      nameEl.textContent = file.name;

      const sizeEl = document.createElement("span");
      sizeEl.className = "file-list__size";
      sizeEl.textContent = formatFileSize(file.size);

      meta.appendChild(nameEl);
      if (sizeEl.textContent) meta.appendChild(sizeEl);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "file-list__remove";
      removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        selectedFiles = selectedFiles.filter((_, i) => i !== index);
        syncFileInput();
        setFileLimitMessage("");
        renderSelectedFiles();
      });

      li.appendChild(meta);
      li.appendChild(removeBtn);
      fileListEl.appendChild(li);
    });
  };

  const clearSelectedFiles = () => {
    selectedFiles = [];
    syncFileInput();
    setFileLimitMessage("");
    renderSelectedFiles();
  };

  /**
   * @param {FileList|File[]} incoming
   * @param {{ mode?: "replace" | "append" }} [opts]
   */
  const applySelectedFiles = (incoming, opts = {}) => {
    const mode = opts.mode === "append" ? "append" : "replace";
    const nextIncoming = Array.from(incoming || []).filter(Boolean);
    let next =
      mode === "append" ? selectedFiles.slice() : [];

    let truncated = false;
    for (const file of nextIncoming) {
      if (next.length >= MAX_QUOTE_FILES) {
        truncated = true;
        break;
      }
      const dup = next.some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
      );
      if (dup) continue;
      next.push(file);
    }
    if (mode === "replace" && nextIncoming.length > MAX_QUOTE_FILES) {
      truncated = true;
    }

    selectedFiles = next.slice(0, MAX_QUOTE_FILES);
    syncFileInput();
    renderSelectedFiles();
    setFileLimitMessage(
      truncated
        ? `You can select up to ${MAX_QUOTE_FILES} files. Only the first ${MAX_QUOTE_FILES} were kept.`
        : ""
    );
  };

  if (dropzone && fileInput) {
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
        applySelectedFiles(e.dataTransfer.files, { mode: "append" });
      }
    });
    fileInput.addEventListener("change", () => {
      if (!fileInput.files?.length) return;
      applySelectedFiles(fileInput.files, { mode: "replace" });
    });
  }

  /* Quote form → POST /api/contact (Brevo email). WhatsApp remains optional secondary UX. */
  const form = document.querySelector("[data-quote-form]");
  if (form) {
    const WA_E164 = "8801999966382";
    const escapeHtml = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = form.querySelector("[data-form-status]");
      const submitBtn = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const details = String(fd.get("details") || "").trim();

      const showStatus = (html, ok = true) => {
        if (!note) return;
        note.hidden = false;
        note.classList.toggle("form-status--ok", ok);
        note.classList.toggle("form-status--err", !ok);
        note.innerHTML = html;
      };

      if (!selectedFiles.length) {
        showStatus("Please upload at least one logo file.", false);
        return;
      }

      if (!email) {
        showStatus("Please enter your email so we can reply.", false);
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      showStatus("Preparing files and sending your quote request…", true);

      const fallbackWaUrl = `https://wa.me/${WA_E164}?text=${encodeURIComponent(
        [
          "Free vector quote request (Manual Vector Tracing)",
          "",
          `Name: ${name || "—"}`,
          `Email: ${email}`,
          `Details: ${details || "—"}`,
        ].join("\n")
      )}`;
      let waUrl = fallbackWaUrl;

      try {
        const { files: filesMeta, skippedLarge } = await buildFilesPayload(selectedFiles);
        const fileNames = filesMeta.map((f) => f.name);
        const fileName = fileNames.join(", ");

        const lines = [
          "Free vector quote request (Manual Vector Tracing)",
          "",
          `Name: ${name || "—"}`,
          `Email: ${email}`,
          `Details: ${details || "—"}`,
        ];
        if (fileNames.length) {
          lines.push(
            `Selected files: ${fileNames
              .map((n, i) => {
                const size = formatFileSize(filesMeta[i].size);
                const tagged = filesMeta[i].contentBase64
                  ? `${n}${size ? ` (${size})` : ""}`
                  : `${n}${size ? ` (${size})` : ""} — ${TOO_LARGE_NOTE}`;
                return tagged;
              })
              .join(", ")}`
          );
          if (skippedLarge) {
            lines.push(
              `(${skippedLarge} file(s) too large for email attach — please send via WhatsApp)`
            );
          }
        }
        const waBody = lines.join("\n");
        waUrl = `https://wa.me/${WA_E164}?text=${encodeURIComponent(waBody)}`;

        const payload = {
          name,
          email,
          use: "",
          deadline: "",
          message: details,
          files: filesMeta,
          fileNames,
          fileName,
          timestamp: new Date().toISOString(),
        };

        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }

        if (!res.ok || !data || data.status !== "success") {
          const msg =
            (data && data.message) ||
            "We couldn’t send your quote right now. Please try again or message us on WhatsApp.";
          showStatus(
            `${escapeHtml(msg)} <a href="${waUrl}" target="_blank" rel="noopener noreferrer">Open WhatsApp instead</a>.`,
            false
          );
          return;
        }

        if (typeof window.trackEvent === "function") {
          /* Primary conversion events for GTM / Google Ads.
             email (and phone if ever added) are plain text for Enhanced Conversions
             mapping in GTM — Google’s tag hashes; do not invent client hashing here. */
          const leadPayload = {
            form_name: "contact_quote",
            method: "quote_form",
            email: email || undefined,
            has_file: fileNames.length > 0,
            file_count: fileNames.length,
          };
          window.trackEvent("quote_submit_success", leadPayload);
          window.trackEvent("generate_lead", leadPayload);
        }

        /* Post-submit thank-you page (dedicated page vs RS in-modal success).
           Fire tracking above before navigating so GTM/Ads still receive the events. */
        const thanksQs = name ? `?name=${encodeURIComponent(name)}` : "";
        window.location.assign(`thanks.html${thanksQs}`);
        return;
      } catch (_) {
        showStatus(
          `Network error — please try again or <a href="${waUrl}" target="_blank" rel="noopener noreferrer">send via WhatsApp</a>.`,
          false
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* Modest floating WhatsApp control (P1 contact reachability; site green + WA icon) */
  if (!document.querySelector(".wa-float")) {
    const float = document.createElement("a");
    float.className = "wa-float";
    float.href = "https://wa.me/8801999966382";
    float.target = "_blank";
    float.rel = "noopener noreferrer";
    float.setAttribute("aria-label", "Chat on WhatsApp");
    float.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/><path d="M12.04 2C6.5 2 2.02 6.48 2.02 12c0 1.85.5 3.58 1.38 5.07L2 22l5.08-1.33A9.96 9.96 0 0 0 12.04 22C17.56 22 22 17.52 22 12S17.56 2 12.04 2zm0 18.15c-1.67 0-3.22-.5-4.52-1.35l-.32-.2-3.01.79.8-2.94-.21-.33a8.12 8.12 0 0 1-1.25-4.32c0-4.5 3.66-8.15 8.17-8.15 4.5 0 8.15 3.65 8.15 8.15 0 4.5-3.65 8.15-8.15 8.15z"/></svg>';
    /* whatsapp_click is bound via document delegation in tracking.js */
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
      {
        id: "top",
        test: (href) => {
          const h = href.trim();
          return h === "" || h === "/" || h === "#" || h === "#top" || /^index\.html(?:#top)?$/i.test(h);
        },
      },
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

      let currentId = "top";
      let spyLockUntil = 0;
      const headerOffset = () => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue("--header-h").trim();
        const n = Number.parseFloat(raw);
        return Number.isFinite(n) ? n : 76;
      };

      const linkedIds = new Set(
        spyTargets
          .filter((t) => spyLinks.some((a) => t.test(a.getAttribute("href") || "")))
          .map((t) => t.id)
      );

      const resolveLinkedId = (id) => {
        if (linkedIds.has(id)) return id;
        const order = elements.map((e) => e.id);
        const idx = order.indexOf(id);
        for (let i = idx; i >= 0; i--) {
          if (linkedIds.has(order[i])) return order[i];
        }
        return "top";
      };

      /* Prefer the last section whose document top has crossed below the fixed header */
      const updateSpy = () => {
        if (performance.now() < spyLockUntil) return;
        const y = window.scrollY + headerOffset() + 12;
        let active = elements[0]?.id || "top";
        for (const { id, el } of elements) {
          if (el.offsetTop <= y) active = id;
        }
        const next = resolveLinkedId(active);
        if (next !== currentId) {
          currentId = next;
          setActiveSection(currentId);
        }
      };

      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          updateSpy();
        });
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      window.addEventListener("hashchange", () => setTimeout(updateSpy, 50));
      nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          const href = link.getAttribute("href") || "";
          const matched = spyTargets.find((t) => t.test(href));
          if (matched && linkedIds.has(matched.id)) {
            currentId = matched.id;
            setActiveSection(currentId);
            /* Keep highlight stable while smooth-scroll animates */
            spyLockUntil = performance.now() + 750;
          }
          setTimeout(updateSpy, 800);
        });
      });
      updateSpy();
      setActiveSection(currentId);
    }
  }
})();
