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
      stage.setPointerCapture(e.pointerId);
      pointerMove(e.clientX);
    });
    stage.addEventListener("pointermove", (e) => {
      if (stage.hasPointerCapture(e.pointerId)) pointerMove(e.clientX);
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
      dropzone.querySelector("span").textContent = "Ready to attach with your quote request";
    };
    dropzone.addEventListener("click", () => fileInput.click());
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

  const form = document.querySelector("[data-quote-form]");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = form.querySelector("[data-form-status]");
      if (note) {
        note.hidden = false;
        note.textContent = "Thanks — this demo form is ready to wire to your email or CRM.";
      }
      form.reset();
    });
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
