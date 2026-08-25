/* =========================================================
   BULKKOT — MAIN JAVASCRIPT
   js/main.js
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     HELPERS
  ======================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const body = document.body;

  function lockBodyScroll(lock) {
    body.classList.toggle("no-scroll", lock);
  }

  function getFocusable(container) {
    if (!container) return [];

    return $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    );
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* =======================================================
     MOBILE NAVIGATION DRAWER
     ======================================================= */

  function toggleMobileDrawer(open) {
    const drawer = $("[data-mobile-drawer]");

    if (!drawer) return;

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !drawer.classList.contains("is-open");

    drawer.classList.toggle("is-open", shouldOpen);
    drawer.setAttribute("aria-hidden", String(!shouldOpen));

    lockBodyScroll(shouldOpen);

    if (shouldOpen) {
      const firstFocusable = getFocusable(drawer)[0];

      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
    }
  }

  $$("[data-open-drawer]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      toggleMobileDrawer(true);
    });
  });

  $$("[data-close-drawer]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      toggleMobileDrawer(false);
    });
  });

  const mobileDrawer = $("[data-mobile-drawer]");

  if (mobileDrawer) {
    mobileDrawer.addEventListener("click", event => {
      if (event.target === mobileDrawer) {
        toggleMobileDrawer(false);
      }
    });

    $$("a", mobileDrawer).forEach(link => {
      link.addEventListener("click", () => {
        toggleMobileDrawer(false);
      });
    });
  }


  /* =======================================================
     SEARCH OVERLAY
     ======================================================= */

  function toggleSearch(open) {
    const modal = $("[data-search-modal]");

    if (!modal) return;

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !modal.classList.contains("is-open");

    modal.classList.toggle("is-open", shouldOpen);
    modal.setAttribute("aria-hidden", String(!shouldOpen));

    lockBodyScroll(shouldOpen);

    if (shouldOpen) {
      const input = $("input", modal);

      if (input) {
        setTimeout(() => input.focus(), 100);
      }
    }
  }

  $$("[data-open-search]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      toggleSearch(true);
    });
  });

  $$("[data-close-search]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      toggleSearch(false);
    });
  });

  const searchModal = $("[data-search-modal]");

  if (searchModal) {
    searchModal.addEventListener("click", event => {
      if (event.target === searchModal) {
        toggleSearch(false);
      }
    });
  }

  const searchForm = $("[data-search-form]");

  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();

      const input = $("input[name='q']", searchForm)
        || $("input", searchForm);

      if (!input) return;

      const query = input.value.trim();

      if (!query) {
        input.focus();
        return;
      }

      /*
       * Future:
       * Replace this with Shopify/Supabase/catalog search.
       */

      filterCatalog(query);

      toggleSearch(false);

      document.dispatchEvent(
        new CustomEvent("bulkkot:search", {
          detail: { query }
        })
      );
    });
  }


  /* =======================================================
     ABOUT STORY MODAL
     ======================================================= */

  function toggleAbout(open) {
    const modal = $("[data-about-modal]");

    if (!modal) return;

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !modal.classList.contains("is-open");

    modal.classList.toggle("is-open", shouldOpen);
    modal.setAttribute("aria-hidden", String(!shouldOpen));

    lockBodyScroll(shouldOpen);

    if (shouldOpen) {
      const closeButton =
        $("[data-close-about]", modal);

      if (closeButton) {
        setTimeout(() => closeButton.focus(), 100);
      }
    }
  }

  $$("[data-open-about]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      toggleAbout(true);
    });
  });

  $$("[data-close-about]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      toggleAbout(false);
    });
  });

  const aboutModal = $("[data-about-modal]");

  if (aboutModal) {
    aboutModal.addEventListener("click", event => {
      if (event.target === aboutModal) {
        toggleAbout(false);
      }
    });
  }


  /* =======================================================
     LEGAL / HELP / INFORMATION MODALS
     ======================================================= */

  const policyContent = {
    faq: {
      title: "FAQ",
      korean: "자주 묻는 질문",
      content: `
        <p><strong>When will BULKKOT launch?</strong></p>
        <p>
          DROP 001 is currently preparing for launch.
          Join the waitlist to receive the latest updates.
        </p>

        <p><strong>Where does BULKKOT ship?</strong></p>
        <p>
          BULKKOT currently focuses on serving customers in India.
        </p>

        <p><strong>How can I contact BULKKOT?</strong></p>
        <p>
          Email us at
          <a href="mailto:bulkkotwear@gmail.com">
            bulkkotwear@gmail.com
          </a>.
        </p>
      `
    },

    size: {
      title: "Size Guide",
      korean: "사이즈 가이드",
      content: `
        <p>
          BULKKOT is designed around an oversized,
          relaxed everyday silhouette.
        </p>

        <p>
          The final size chart will be published with each
          product before launch.
        </p>

        <p>
          Always check the individual product measurements
          before placing an order.
        </p>
      `
    },

    shipping: {
      title: "Shipping Policy",
      korean: "배송 정책",
      content: `
        <p>
          Shipping details and estimated delivery timelines
          will be displayed during checkout.
        </p>

        <p>
          Delivery timelines may vary depending on location,
          courier availability and order volume.
        </p>
      `
    },

    returns: {
      title: "Returns & Exchange",
      korean: "반품 및 교환",
      content: `
        <p>
          BULKKOT's return and exchange conditions will be
          clearly communicated before checkout.
        </p>

        <p>
          Products must meet the applicable return conditions
          and may be subject to inspection.
        </p>
      `
    },

    privacy: {
      title: "Privacy Policy",
      korean: "개인정보 보호",
      content: `
        <p>
          BULKKOT respects your privacy and only uses customer
          information for legitimate business purposes.
        </p>

        <p>
          Information submitted through forms may be used for
          order processing, customer support and communications
          that you have requested.
        </p>
      `
    },

    terms: {
      title: "Terms & Conditions",
      korean: "이용 약관",
      content: `
        <p>
          By using the BULKKOT website, you agree to follow
          the applicable website, purchasing and account terms.
        </p>

        <p>
          Product availability, pricing and policies may change
          before launch or from one collection to another.
        </p>
      `
    },

    refund: {
      title: "Refund Policy",
      korean: "환불 정책",
      content: `
        <p>
          Refund eligibility will depend on the applicable
          product and order conditions.
        </p>

        <p>
          Final refund rules will be displayed clearly before
          purchase and checkout.
        </p>
      `
    }
  };

  function openPolicyModal(type) {
    const data = policyContent[type];

    if (!data) return;

    let modal = $("[data-policy-modal]");

    if (!modal) {
      modal = document.createElement("div");

      modal.className = "modal policy-modal";
      modal.setAttribute("data-policy-modal", "");
      modal.setAttribute("aria-hidden", "true");

      modal.innerHTML = `
        <div class="modal__backdrop" data-close-policy></div>

        <div
          class="modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
        >
          <button
            type="button"
            class="modal__close"
            data-close-policy
            aria-label="Close"
          >
            ×
          </button>

          <p class="modal__korean" data-policy-korean></p>

          <h2
            id="policy-modal-title"
            data-policy-title
          ></h2>

          <div
            class="modal__content"
            data-policy-content
          ></div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.addEventListener("click", event => {
        if (event.target.closest("[data-close-policy]")) {
          closePolicyModal();
        }
      });
    }

    $("[data-policy-title]", modal).textContent = data.title;
    $("[data-policy-korean]", modal).textContent = data.korean;
    $("[data-policy-content]", modal).innerHTML = data.content;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    lockBodyScroll(true);
  }

  function closePolicyModal() {
    const modal = $("[data-policy-modal]");

    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    lockBodyScroll(false);
  }

  const policyMap = {
    faq: "faq",
    "faq-link": "faq",
    size: "size",
    "size-guide": "size",
    shipping: "shipping",
    "shipping-policy": "shipping",
    returns: "returns",
    "return-policy": "returns",
    "returns-exchange": "returns",
    privacy: "privacy",
    "privacy-policy": "privacy",
    terms: "terms",
    "terms-conditions": "terms",
    refund: "refund",
    "refund-policy": "refund"
  };

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-policy]");

    if (!trigger) return;

    event.preventDefault();

    const type =
      trigger.dataset.policy ||
      trigger.dataset.policyType;

    if (policyMap[type]) {
      openPolicyModal(policyMap[type]);
    }
  });


  /* =======================================================
     EDITORIAL CAROUSEL
     ======================================================= */

  function initCarousel(carousel) {
    const track = $("[data-carousel-track]", carousel);
    const slides = $$("[data-slide]", carousel);
    const previous = $("[data-carousel-prev]", carousel);
    const next = $("[data-carousel-next]", carousel);

    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    let autoplayTimer = null;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const interval =
      Number(carousel.dataset.autoplay) || 5000;

    function goToSlide(index, animate = true) {
      if (!slides.length) return;

      currentIndex =
        (index + slides.length) % slides.length;

      track.style.transition = animate
        ? "transform 500ms cubic-bezier(.22,.61,.36,1)"
        : "none";

      track.style.transform =
        `translate3d(-${currentIndex * 100}%, 0, 0)`;

      slides.forEach((slide, index) => {
        slide.classList.toggle(
          "is-active",
          index === currentIndex
        );
      });

      const dots =
        $$("[data-carousel-dot]", carousel);

      dots.forEach((dot, index) => {
        dot.classList.toggle(
          "is-active",
          index === currentIndex
        );

        dot.setAttribute(
          "aria-current",
          index === currentIndex
            ? "true"
            : "false"
        );
      });
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function previousSlide() {
      goToSlide(currentIndex - 1);
    }

    function startAutoplay() {
      stopAutoplay();

      if (slides.length <= 1) return;

      autoplayTimer = setInterval(
        nextSlide,
        interval
      );
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    if (next) {
      next.addEventListener("click", () => {
        nextSlide();
        startAutoplay();
      });
    }

    if (previous) {
      previous.addEventListener("click", () => {
        previousSlide();
        startAutoplay();
      });
    }

    $$("[data-carousel-dot]", carousel)
      .forEach((dot, index) => {
        dot.addEventListener("click", () => {
          goToSlide(index);
          startAutoplay();
        });
      });

    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", startAutoplay);

    carousel.addEventListener(
      "touchstart",
      event => {
        if (!event.touches.length) return;

        startX = event.touches[0].clientX;
        currentX = startX;
        isDragging = true;

        stopAutoplay();

        track.style.transition = "none";
      },
      { passive: true }
    );

    carousel.addEventListener(
      "touchmove",
      event => {
        if (!isDragging || !event.touches.length) return;

        currentX = event.touches[0].clientX;

        const difference = currentX - startX;
        const percentage =
          (difference / carousel.offsetWidth) * 100;

        track.style.transform =
          `translate3d(${
            -currentIndex * 100 + percentage
          }%, 0, 0)`;
      },
      { passive: true }
    );

    carousel.addEventListener(
      "touchend",
      () => {
        if (!isDragging) return;

        isDragging = false;

        const difference = currentX - startX;
        const threshold = 50;

        if (Math.abs(difference) > threshold) {
          if (difference < 0) {
            nextSlide();
          } else {
            previousSlide();
          }
        } else {
          goToSlide(currentIndex);
        }

        startAutoplay();
      },
      { passive: true }
    );

    carousel.addEventListener(
      "keydown",
      event => {
        if (event.key === "ArrowRight") {
          nextSlide();
          startAutoplay();
        }

        if (event.key === "ArrowLeft") {
          previousSlide();
          startAutoplay();
        }
      }
    );

    goToSlide(0, false);
    startAutoplay();
  }

  $$("[data-carousel]").forEach(initCarousel);


  /* =======================================================
     CATEGORY FILTER
     ======================================================= */

  function filterCatalog(category) {
    const normalizedCategory =
      String(category || "")
        .trim()
        .toLowerCase();

    const products = $$(
      "[data-product-card]"
    );

    if (!products.length) {
      document.dispatchEvent(
        new CustomEvent("bulkkot:category-filter", {
          detail: {
            category: normalizedCategory
          }
        })
      );

      return;
    }

    products.forEach(product => {
      const productCategory =
        String(
          product.dataset.category || "all"
        ).toLowerCase();

      const show =
        !normalizedCategory ||
        normalizedCategory === "all" ||
        productCategory === normalizedCategory;

      product.hidden = !show;
      product.classList.toggle(
        "is-filtered-out",
        !show
      );
    });

    $$("[data-category]").forEach(button => {
      const buttonCategory =
        String(
          button.dataset.category || ""
        ).toLowerCase();

      button.classList.toggle(
        "is-active",
        buttonCategory === normalizedCategory
      );
    });

    document.dispatchEvent(
      new CustomEvent("bulkkot:category-filter", {
        detail: {
          category: normalizedCategory
        }
      })
    );
  }

  window.filterCatalog = filterCatalog;

  $$("[data-category]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();

      filterCatalog(
        button.dataset.category
      );

      const target =
        button.dataset.categoryTarget;

      if (target) {
        const element = $(target);

        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }
    });
  });


  /* =======================================================
     VIP WAITLIST
     ======================================================= */

  function initWaitlistForm(form) {
    const emailInput =
      $("input[type='email']", form);

    const submitButton =
      $("button[type='submit']", form);

    let message =
      $("[data-waitlist-message]", form);

    if (!message) {
      message = document.createElement("p");
      message.className =
        "waitlist__message";
      message.setAttribute(
        "data-waitlist-message",
        ""
      );

      form.appendChild(message);
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!emailInput) return;

      const email =
        emailInput.value.trim();

      if (!email) {
        showWaitlistMessage(
          message,
          "Please enter your email address.",
          "error"
        );

        emailInput.focus();
        return;
      }

      const validEmail =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          .test(email);

      if (!validEmail) {
        showWaitlistMessage(
          message,
          "Please enter a valid email address.",
          "error"
        );

        emailInput.focus();
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText =
          submitButton.textContent;

        submitButton.textContent =
          "JOINING...";
      }

      try {
        /*
         * ===================================================
         * SUPABASE HOOK
         * ===================================================
         *
         * When Supabase is connected, replace this section
         * with your actual Supabase insert call.
         *
         * Example:
         *
         * const { error } = await supabase
         *   .from("waitlist")
         *   .insert([{ email }]);
         *
         * if (error) throw error;
         *
         * ===================================================
         */

        if (
          window.BULKKOT_SUPABASE &&
          typeof window.BULKKOT_SUPABASE.addToWaitlist ===
            "function"
        ) {
          await window.BULKKOT_SUPABASE
            .addToWaitlist(email);
        } else {
          /*
           * Temporary frontend-only success state.
           * No fake backend request is made.
           */

          const waitlist =
            JSON.parse(
              localStorage.getItem(
                "bulkkot_waitlist"
              ) || "[]"
            );

          if (!waitlist.includes(email)) {
            waitlist.push(email);

            localStorage.setItem(
              "bulkkot_waitlist",
              JSON.stringify(waitlist)
            );
          }
        }

        showWaitlistMessage(
          message,
          "You're on the list. We'll see you at DROP 001.",
          "success"
        );

        emailInput.value = "";

        document.dispatchEvent(
          new CustomEvent(
            "bulkkot:waitlist-success",
            {
              detail: { email }
            }
          )
        );

      } catch (error) {
        console.error(
          "BULKKOT Waitlist Error:",
          error
        );

        showWaitlistMessage(
          message,
          "Something went wrong. Please try again.",
          "error"
        );

      } finally {
        if (submitButton) {
          submitButton.disabled = false;

          submitButton.textContent =
            submitButton.dataset.originalText ||
            "JOIN WAITLIST";
        }
      }
    });
  }

  function showWaitlistMessage(
    element,
    text,
    type
  ) {
    element.textContent = text;

    element.classList.remove(
      "is-success",
      "is-error"
    );

    element.classList.add(
      type === "success"
        ? "is-success"
        : "is-error"
    );

    element.setAttribute(
      "role",
      "status"
    );
  }

  $$("[data-waitlist-form]")
    .forEach(initWaitlistForm);


  /* =======================================================
     CART INTEGRATION
     ======================================================= */

  document.addEventListener(
    "bulkkot:cart-updated",
    () => {
      if (
        window.BULKKOTCart &&
        typeof window.BULKKOTCart.updateCartBadge ===
          "function"
      ) {
        window.BULKKOTCart.updateCartBadge();
      }
    }
  );


  /* =======================================================
     ESCAPE KEY — CLOSE ALL ACTIVE OVERLAYS
     ======================================================= */

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape") return;

      const cartDrawer =
        $("[data-cart-drawer]");

      if (
        cartDrawer &&
        cartDrawer.classList.contains("is-open")
      ) {
        if (
          window.BULKKOTCart &&
          typeof window.BULKKOTCart.toggleCartDrawer ===
            "function"
        ) {
          window.BULKKOTCart.toggleCartDrawer(false);
        }
      }

      const mobileDrawer =
        $("[data-mobile-drawer]");

      if (
        mobileDrawer &&
        mobileDrawer.classList.contains("is-open")
      ) {
        toggleMobileDrawer(false);
      }

      const searchModal =
        $("[data-search-modal]");

      if (
        searchModal &&
        searchModal.classList.contains("is-open")
      ) {
        toggleSearch(false);
      }

      const aboutModal =
        $("[data-about-modal]");

      if (
        aboutModal &&
        aboutModal.classList.contains("is-open")
      ) {
        toggleAbout(false);
      }

      closePolicyModal();

      /*
       * Only unlock body if no overlay remains open.
       */
      requestAnimationFrame(() => {
        const activeOverlay =
          $(
            "[data-cart-drawer].is-open, " +
            "[data-mobile-drawer].is-open, " +
            "[data-search-modal].is-open, " +
            "[data-about-modal].is-open, " +
            "[data-policy-modal].is-open"
          );

        if (!activeOverlay) {
          lockBodyScroll(false);
        }
      });
    }
  );


  /* =======================================================
     PREVENT BACKGROUND SCROLL FOR OPEN MODALS
     ======================================================= */

  function syncBodyScroll() {
    const activeOverlay =
      $(
        "[data-cart-drawer].is-open, " +
        "[data-mobile-drawer].is-open, " +
        "[data-search-modal].is-open, " +
        "[data-about-modal].is-open, " +
        "[data-policy-modal].is-open"
      );

    lockBodyScroll(Boolean(activeOverlay));
  }

  const observer =
    new MutationObserver(syncBodyScroll);

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });


  /* =======================================================
     REDUCED MOTION
     ======================================================= */

  const reducedMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

  if (reducedMotion.matches) {
    $$("[data-carousel]").forEach(
      carousel => {
        carousel.dataset.autoplay = "0";
      }
    );
  }


  /* =======================================================
     INITIALIZATION
     ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      if (
        window.BULKKOTCart &&
        typeof window.BULKKOTCart.updateCartBadge ===
          "function"
      ) {
        window.BULKKOTCart.updateCartBadge();
      }

      if (
        window.BULKKOTCart &&
        typeof window.BULKKOTCart.renderCartDrawer ===
          "function"
      ) {
        window.BULKKOTCart.renderCartDrawer();
      }

      /*
       * Mark JS as loaded.
       * Useful for CSS progressive enhancement.
       */
      document.documentElement.classList.add(
        "js-loaded"
      );
    }
  );

})();
