/* =========================================================
   BULKKOT (불꽃) — MAIN JAVASCRIPT
   File: js/main.js
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     DOM Helpers
  --------------------------------------------------------- */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  /* ---------------------------------------------------------
     Body Scroll Lock
  --------------------------------------------------------- */

  let scrollPosition = 0;

  function lockBodyScroll() {
    if (document.body.classList.contains("is-scroll-locked")) {
      return;
    }

    scrollPosition = window.scrollY;

    document.body.classList.add("is-scroll-locked");

    document.body.style.top = `-${scrollPosition}px`;
  }

  function unlockBodyScroll() {
    if (!document.body.classList.contains("is-scroll-locked")) {
      return;
    }

    document.body.classList.remove("is-scroll-locked");

    document.body.style.top = "";

    window.scrollTo({
      top: scrollPosition,
      behavior: "instant"
    });
  }

  /* ---------------------------------------------------------
     Mobile Drawer
  --------------------------------------------------------- */

  const mobileDrawer =
    document.querySelector("[data-mobile-drawer]");

  function toggleMobileDrawer(open) {
    if (!mobileDrawer) {
      return;
    }

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !mobileDrawer.classList.contains("is-open");

    mobileDrawer.classList.toggle(
      "is-open",
      shouldOpen
    );

    mobileDrawer.setAttribute(
      "aria-hidden",
      String(!shouldOpen)
    );

    document.body.classList.toggle(
      "mobile-drawer-open",
      shouldOpen
    );

    if (shouldOpen) {
      lockBodyScroll();

      const firstFocusable =
        mobileDrawer.querySelector(
          "button, a, input, [tabindex]:not([tabindex='-1'])"
        );

      if (firstFocusable) {
        setTimeout(
          () => firstFocusable.focus(),
          100
        );
      }
    } else {
      unlockBodyScroll();
    }
  }

  /* ---------------------------------------------------------
     Search Modal
  --------------------------------------------------------- */

  const searchModal =
    document.querySelector("[data-search-modal]");

  function toggleSearch(open) {
    if (!searchModal) {
      return;
    }

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !searchModal.classList.contains("is-open");

    searchModal.classList.toggle(
      "is-open",
      shouldOpen
    );

    searchModal.setAttribute(
      "aria-hidden",
      String(!shouldOpen)
    );

    if (shouldOpen) {
      lockBodyScroll();

      const input =
        searchModal.querySelector(
          "input[type='search'], input"
        );

      if (input) {
        setTimeout(() => input.focus(), 120);
      }
    } else {
      unlockBodyScroll();
    }
  }

  function submitSearch(query) {
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
      return;
    }

    /*
      Future product-search integration point.

      Example:
      window.location.href =
        `/shop.html?search=${encodeURIComponent(cleanQuery)}`;
    */

    document.dispatchEvent(
      new CustomEvent("bulkkot:search", {
        detail: {
          query: cleanQuery
        }
      })
    );

    console.info(
      "BULKKOT search query:",
      cleanQuery
    );
  }

  /* ---------------------------------------------------------
     About Story Modal
  --------------------------------------------------------- */

  const aboutModal =
    document.querySelector("[data-about-modal]");

  function toggleAbout(open) {
    if (!aboutModal) {
      return;
    }

    const shouldOpen =
      typeof open === "boolean"
        ? open
        : !aboutModal.classList.contains("is-open");

    aboutModal.classList.toggle(
      "is-open",
      shouldOpen
    );

    aboutModal.setAttribute(
      "aria-hidden",
      String(!shouldOpen)
    );

    if (shouldOpen) {
      lockBodyScroll();

      const closeButton =
        aboutModal.querySelector(
          "[data-close-about]"
        );

      if (closeButton) {
        setTimeout(
          () => closeButton.focus(),
          100
        );
      }
    } else {
      unlockBodyScroll();
    }
  }

  /* ---------------------------------------------------------
     Carousel
  --------------------------------------------------------- */

  const carousels = new WeakMap();

  function initializeCarousel(carousel) {
    if (!carousel) {
      return;
    }

    const track =
      carousel.querySelector(
        "[data-carousel-track]"
      );

    const slides =
      $$(".data-slide", carousel);

    /*
      The selector above intentionally falls back to the
      data attribute query below for valid HTML usage.
    */
    const validSlides =
      $$("[data-slide]", carousel);

    if (!track || validSlides.length === 0) {
      return;
    }

    const prevButton =
      carousel.querySelector(
        "[data-carousel-prev]"
      );

    const nextButton =
      carousel.querySelector(
        "[data-carousel-next]"
      );

    const indicators =
      $$("[data-slide-indicator]", carousel);

    let currentIndex = 0;
    let autoplayTimer = null;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const totalSlides = validSlides.length;

    function updateCarousel(
      index,
      animate = true
    ) {
      currentIndex =
        (index + totalSlides) % totalSlides;

      const offset =
        currentIndex * 100;

      track.style.transition =
        animate
          ? "transform 600ms cubic-bezier(.2,.65,.2,1)"
          : "none";

      track.style.transform =
        `translate3d(-${offset}%, 0, 0)`;

      validSlides.forEach(
        (slide, slideIndex) => {
          slide.classList.toggle(
            "is-active",
            slideIndex === currentIndex
          );

          slide.setAttribute(
            "aria-hidden",
            String(slideIndex !== currentIndex)
          );
        }
      );

      indicators.forEach(
        (indicator, indicatorIndex) => {
          indicator.classList.toggle(
            "is-active",
            indicatorIndex === currentIndex
          );

          indicator.setAttribute(
            "aria-current",
            indicatorIndex === currentIndex
              ? "true"
              : "false"
          );
        }
      );
    }

    function next() {
      updateCarousel(currentIndex + 1);
    }

    function previous() {
      updateCarousel(currentIndex - 1);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();

      if (totalSlides <= 1) {
        return;
      }

      autoplayTimer = setInterval(
        next,
        6000
      );
    }

    prevButton?.addEventListener(
      "click",
      () => {
        previous();
        startAutoplay();
      }
    );

    nextButton?.addEventListener(
      "click",
      () => {
        next();
        startAutoplay();
      }
    );

    indicators.forEach(
      (indicator, index) => {
        indicator.addEventListener(
          "click",
          () => {
            updateCarousel(index);
            startAutoplay();
          }
        );
      }
    );

    carousel.addEventListener(
      "pointerdown",
      (event) => {
        startX = event.clientX;
        currentX = event.clientX;
        isDragging = true;

        track.style.transition = "none";
      }
    );

    carousel.addEventListener(
      "pointermove",
      (event) => {
        if (!isDragging) {
          return;
        }

        currentX = event.clientX;
      }
    );

    carousel.addEventListener(
      "pointerup",
      () => {
        if (!isDragging) {
          return;
        }

        const distance =
          currentX - startX;

        isDragging = false;

        if (Math.abs(distance) > 50) {
          if (distance < 0) {
            next();
          } else {
            previous();
          }
        } else {
          updateCarousel(
            currentIndex
          );
        }

        startAutoplay();
      }
    );

    carousel.addEventListener(
      "pointercancel",
      () => {
        isDragging = false;
        updateCarousel(
          currentIndex
        );
        startAutoplay();
      }
    );

    carousel.addEventListener(
      "mouseenter",
      stopAutoplay
    );

    carousel.addEventListener(
      "mouseleave",
      startAutoplay
    );

    carousel.addEventListener(
      "focusin",
      stopAutoplay
    );

    carousel.addEventListener(
      "focusout",
      startAutoplay
    );

    updateCarousel(
      0,
      false
    );

    startAutoplay();

    carousels.set(carousel, {
      next,
      previous,
      updateCarousel,
      startAutoplay,
      stopAutoplay
    });
  }

  function initializeAllCarousels() {
    $$("[data-carousel]").forEach(
      initializeCarousel
    );
  }

  /* ---------------------------------------------------------
     Waitlist
  --------------------------------------------------------- */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(email).trim()
    );
  }

  async function submitWaitlist(form) {
    if (!form) {
      return;
    }

    const emailInput =
      form.querySelector(
        "input[type='email']"
      );

    const submitButton =
      form.querySelector(
        "button[type='submit'], input[type='submit']"
      );

    const message =
      form.querySelector(
        "[data-waitlist-message]"
      );

    if (!emailInput) {
      return;
    }

    const email =
      emailInput.value.trim();

    if (!isValidEmail(email)) {
      showFormMessage(
        message,
        "Please enter a valid email address.",
        "error"
      );

      emailInput.focus();

      return;
    }

    const originalButtonText =
      submitButton?.textContent || "JOIN";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        "JOINING...";
    }

    try {
      /*
        SUPABASE INTEGRATION HOOK

        When Supabase is connected, replace the
        simulated section below with:

        const { data, error } =
          await supabase
            .from("waitlist")
            .insert([
              {
                email: email
              }
            ]);

        if (error) {
          throw error;
        }

        Keep the rest of the UI handling unchanged.
      */

      const supabaseClient =
        window.supabaseClient ||
        window.BULKKOT_SUPABASE ||
        null;

      if (supabaseClient?.from) {
        const { error } =
          await supabaseClient
            .from("waitlist")
            .insert([
              {
                email
              }
            ]);

        if (error) {
          throw error;
        }
      } else {
        /*
          Backend is not connected yet.
          The form still works as a frontend hook.
        */

        console.info(
          "BULKKOT waitlist backend is not connected yet.",
          { email }
        );
      }

      showFormMessage(
        message,
        "You're on the list. Welcome to BULKKOT.",
        "success"
      );

      emailInput.value = "";

      form.dispatchEvent(
        new CustomEvent(
          "bulkkot:waitlist-success",
          {
            bubbles: true,
            detail: {
              email
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "BULKKOT waitlist error:",
        error
      );

      showFormMessage(
        message,
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent =
          originalButtonText;
      }
    }
  }

  function showFormMessage(
    element,
    text,
    type
  ) {
    if (!element) {
      return;
    }

    element.textContent = text;

    element.classList.remove(
      "is-error",
      "is-success"
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

  /* ---------------------------------------------------------
     Category Filter
  --------------------------------------------------------- */

  function filterCatalog(category) {
    const normalizedCategory =
      String(category || "all")
        .trim()
        .toLowerCase();

    const products =
      $$("[data-product-card]");

    products.forEach(
      (product) => {
        const productCategory =
          String(
            product.dataset.category ||
              "all"
          ).toLowerCase();

        const shouldShow =
          normalizedCategory === "all" ||
          productCategory ===
            normalizedCategory;

        product.hidden = !shouldShow;

        product.classList.toggle(
          "is-filtered-out",
          !shouldShow
        );
      }
    );

    document.dispatchEvent(
      new CustomEvent(
        "bulkkot:category-filter",
        {
          detail: {
            category:
              normalizedCategory
          }
        }
      )
    );

    return normalizedCategory;
  }

  /* ---------------------------------------------------------
     Search Form
  --------------------------------------------------------- */

  function initializeSearch() {
    if (!searchModal) {
      return;
    }

    const form =
      searchModal.querySelector(
        "form"
      );

    const input =
      searchModal.querySelector(
        "input[type='search'], input"
      );

    form?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        submitSearch(
          input?.value
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Category Buttons
  --------------------------------------------------------- */

  function initializeCategoryButtons() {
    $$("[data-category]").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            filterCatalog(
              button.dataset.category
            );
          }
        );
      }
    );
  }

  /* ---------------------------------------------------------
     Event Delegation
  --------------------------------------------------------- */

  document.addEventListener(
    "click",
    (event) => {
      const openDrawer =
        event.target.closest(
          "[data-open-drawer]"
        );

      if (openDrawer) {
        event.preventDefault();
        toggleMobileDrawer(true);
        return;
      }

      const closeDrawer =
        event.target.closest(
          "[data-close-drawer]"
        );

      if (closeDrawer) {
        event.preventDefault();
        toggleMobileDrawer(false);
        return;
      }

      const drawerLink =
        event.target.closest(
          "[data-mobile-drawer] a"
        );

      if (drawerLink) {
        toggleMobileDrawer(false);
      }

      const openSearch =
        event.target.closest(
          "[data-open-search]"
        );

      if (openSearch) {
        event.preventDefault();
        toggleSearch(true);
        return;
      }

      const closeSearch =
        event.target.closest(
          "[data-close-search]"
        );

      if (closeSearch) {
        event.preventDefault();
        toggleSearch(false);
        return;
      }

      const openAbout =
        event.target.closest(
          "[data-open-about]"
        );

      if (openAbout) {
        event.preventDefault();
        toggleAbout(true);
        return;
      }

      const closeAbout =
        event.target.closest(
          "[data-close-about]"
        );

      if (closeAbout) {
        event.preventDefault();
        toggleAbout(false);
        return;
      }

      /*
        Clicking a modal backdrop closes it.
      */

      if (
        searchModal &&
        event.target === searchModal
      ) {
        toggleSearch(false);
      }

      if (
        aboutModal &&
        event.target === aboutModal
      ) {
        toggleAbout(false);
      }

      if (
        mobileDrawer &&
        event.target === mobileDrawer
      ) {
        toggleMobileDrawer(false);
      }
    }
  );

  /* ---------------------------------------------------------
     Waitlist Forms
  --------------------------------------------------------- */

  document.addEventListener(
    "submit",
    (event) => {
      const form =
        event.target.closest(
          "[data-waitlist-form]"
        );

      if (!form) {
        return;
      }

      event.preventDefault();

      submitWaitlist(form);
    }
  );

  /* ---------------------------------------------------------
     Escape Key
  --------------------------------------------------------- */

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (
        searchModal?.classList.contains(
          "is-open"
        )
      ) {
        toggleSearch(false);
        return;
      }

      if (
        aboutModal?.classList.contains(
          "is-open"
        )
      ) {
        toggleAbout(false);
        return;
      }

      if (
        mobileDrawer?.classList.contains(
          "is-open"
        )
      ) {
        toggleMobileDrawer(false);
        return;
      }

      if (
        window.BULKKOT_CART &&
        document.querySelector(
          "[data-cart-drawer].is-open, #cart-drawer.is-open"
        )
      ) {
        window.BULKKOT_CART.toggleCartDrawer(
          false
        );
      }
    }
  );

  /* ---------------------------------------------------------
     Prevent Background Interaction
  --------------------------------------------------------- */

  window.addEventListener(
    "pageshow",
    () => {
      document.body.classList.remove(
        "is-scroll-locked",
        "mobile-drawer-open",
        "drawer-open"
      );

      document.body.style.top = "";
    }
  );

  /* ---------------------------------------------------------
     Keyboard Accessibility
  --------------------------------------------------------- */

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !== "Tab" ||
        !document.body.classList.contains(
          "is-scroll-locked"
        )
      ) {
        return;
      }

      const activeOverlay =
        document.querySelector(
          "[data-search-modal].is-open, " +
          "[data-about-modal].is-open, " +
          "[data-mobile-drawer].is-open"
        );

      if (!activeOverlay) {
        return;
      }

      const focusable = $$(
        "a[href], button:not([disabled]), " +
        "input:not([disabled]), select:not([disabled]), " +
        "textarea:not([disabled]), " +
        "[tabindex]:not([tabindex='-1'])",
        activeOverlay
      );

      if (!focusable.length) {
        return;
      }

      const first =
        focusable[0];

      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  );

  /* ---------------------------------------------------------
     Initialization
  --------------------------------------------------------- */

  function initialize() {
    initializeAllCarousels();
    initializeSearch();
    initializeCategoryButtons();

    /*
      If cart.js loaded before main.js,
      refresh the badge once more.
    */
    if (
      window.BULKKOT_CART?.updateCartBadge
    ) {
      window.BULKKOT_CART.updateCartBadge();
    }

    document.documentElement.classList.add(
      "js-ready"
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

  /* ---------------------------------------------------------
     Public BULKKOT API
  --------------------------------------------------------- */

  window.BULKKOT = {
    toggleMobileDrawer,
    toggleSearch,
    toggleAbout,
    filterCatalog,
    submitSearch,
    submitWaitlist
  };

  window.filterCatalog =
    filterCatalog;
})();
