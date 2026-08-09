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
})();
