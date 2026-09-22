/**
 * BULKKOT (불꽃) — Main Storefront Engine
 * Production Hardened & Synced
 */
(function () {
  "use strict";

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";
  const FALLBACK_IMAGE = "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";

  const supabase = window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  window.bulkkotSupabase = supabase;

  const state = {
    drawerOpen: false,
    activeModal: null,
    searchOpen: false,
    editorialTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));   const on = (element, event, handler) => element && element.addEventListener(event, handler);    function lockBody() {     document.body.classList.add("modal-open");   }    function unlockBody() {     if (!$$(".is-open, .drawer-open").length) {
      document.body.classList.remove("modal-open", "drawer-open");
    }
  }

  /* --- MOBILE DRAWER --- */
  function initMobileDrawer() {
    const drawer = $("#mobile-drawer") \vert{}\vert{} $("[data-mobile-drawer]");
    const overlay = $("[data-mobile-overlay]") || $("#mobileDrawerOverlay");     const openBtns = $$("[data-open-drawer], #headerMenuToggle");
    const closeBtns = $$("[data-close-drawer], #closeMobileDrawerBtn");      function open() {       state.drawerOpen = true;       drawer?.classList.add("is-open");       drawer?.setAttribute("aria-hidden", "false");       overlay?.classList.add("is-active", "is-visible");       document.body.classList.add("drawer-open");       lockBody();     }      function close() {       state.drawerOpen = false;       drawer?.classList.remove("is-open");       drawer?.setAttribute("aria-hidden", "true");       overlay?.classList.remove("is-active", "is-visible");       document.body.classList.remove("drawer-open");       unlockBody();     }      openBtns.forEach(btn => on(btn, "click", (e) => { e.preventDefault(); open(); }));     closeBtns.forEach(btn => on(btn, "click", (e) => { e.preventDefault(); close(); }));     on(overlay, "click", close);     $$("a", drawer).forEach(a => on(a, "click", close));

    window.BULKKOT_DRAWER = { open, close };
  }

  /* --- SEARCH ENGINE --- */
  function initSearch() {
    const toggle = $("#headerSearchToggle");
    const bar = $("#headerSearchBar");
    const close = $("#headerSearchClose");
    const input = $("#liveSearchInput");
    const form = $("#headerSearchForm");

    function toggleSearch() {
      state.searchOpen = !state.searchOpen;
      bar?.classList.toggle("is-active", state.searchOpen);
      if (state.searchOpen) input?.focus();
    }

    function hideSearch() {
      state.searchOpen = false;
      bar?.classList.remove("is-active");
    }

    on(toggle, "click", (e) => { e.preventDefault(); toggleSearch(); });
    on(close, "click", (e) => { e.preventDefault(); hideSearch(); });

    on(form, "submit", (e) => {
      e.preventDefault();
      const q = input?.value.trim();
      if (q) window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
    });

    on(input, "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = input.value.trim();
        if (q) window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
      }
    });

    $$(".search-tag-btn, [data-search-tag]").forEach(btn => {
      on(btn, "click", () => {
        const term = btn.dataset.searchTag || btn.textContent.trim();
        if (term) window.location.href = `shop.html?q=${encodeURIComponent(term)}`;
      });
    });
  }

  /* --- EDITORIAL CAROUSEL --- */
  function initCarousel() {
    const container = $("#editorialCarousel");
    if (!container) return;

    const slides = $$(".editorial-slide", container);     const dots = $$("[data-slide-indicator], .carousel-indicator", container);
    const prev = $("[data-carousel-prev], .carousel-control--prev", container);
    const next = $("[data-carousel-next], .carousel-control--next", container);

    if (!slides.length) return;
    let idx = 0;

    function show(index) {
      idx = (index + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("is-active", i === idx));
      dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
    }

    on(prev, "click", () => show(idx - 1));
    on(next, "click", () => show(idx + 1));
    dots.forEach((d, i) => on(d, "click", () => show(i)));

    function auto() {
      state.editorialTimer = setInterval(() => show(idx + 1), 6000);
    }
    auto();
    on(container, "mouseenter", () => clearInterval(state.editorialTimer));
    on(container, "mouseleave", auto);
  }

  /* --- MODAL CONTROLLER --- */
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    state.activeModal = modal;
    lockBody();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (state.activeModal === modal) state.activeModal = null;
    unlockBody();
  }

  function initModals() {
    const map = [
      { trigger: "[data-open-about]", modal: "[data-about-modal]", close: "[data-close-about]" },
      { trigger: "[data-open-policy]", modal: "[data-policy-modal]", close: "[data-close-policy]" },
      { trigger: "[data-size-guide-open]", modal: "[data-size-guide-modal]", close: "[data-size-guide-close]" },
      { trigger: "[data-open-track-order]", modal: "[data-track-order-modal]", close: "[data-track-order-close]" },
      { trigger: "[data-open-account]", modal: "[data-account-modal]", close: "[data-account-close]" }
    ];

    map.forEach(({ trigger, modal, close }) => {
      const m = $(modal);$$ (trigger).forEach(btn => on(btn, "click", (e) => {
        e.preventDefault();
        window.BULKKOT_DRAWER?.close();
        openModal(m);
      }));
      $$(close, m).forEach(btn => on(btn, "click", (e) => {         e.preventDefault();         closeModal(m);       }));       on(m, "click", (e) => {         if (e.target === m \vert{}\vert{} e.target.classList.contains("account-backdrop") \vert{}\vert{} e.target.classList.contains("track-order-backdrop") \vert{}\vert{} e.target.classList.contains("size-guide-backdrop")) {           closeModal(m);         }       });     });      /* Size guide tab switcher */     $$
("[data-size-tab]").forEach(tab => {
      on(tab, "click", () => {
        $$("[data-size-tab]").forEach(t => t.classList.toggle("is-active", t === tab));         const target = tab.dataset.sizeTab;         $$
("[data-size-panel]").forEach(p => {
          const match = p.dataset.sizePanel === target;
          p.hidden = !match;
          p.classList.toggle("is-active", match);
        });
      });
    });

    /* Esc Key to Close Everything */
    on(document, "keydown", (e) => {
      if (e.key === "Escape") {
        if (state.activeModal) closeModal(state.activeModal);
        window.BULKKOT_DRAWER?.close();
        window.BULKKOT_CART?.closeCart();
      }
    });
  }

  /* --- GUEST ORDER TRACKING --- */
  function initTracking() {
    const form = $("[data-track-order-form]");
    const modal = $("[data-track-order-modal]");
    const message = $("[data-track-order-message]");
    const result = $("[data-track-order-result]");
    const again = $("[data-track-again]");

    on(again, "click", () => {
      if (result) result.hidden = true;
      if (form) form.hidden = false;
      if (message) message.textContent = "";
    });

    on(form, "submit", async (e) => {
      e.preventDefault();
      if (!supabase) return;

      const orderNo = $("#track-order-number")?.value.trim().toUpperCase();
      const phone = $("#track-order-phone")?.value.trim().replace(/\D/g, "");

      if (!orderNo || !phone) {
        if (message) message.textContent = "Please fill in all details.";
        return;
      }

      if (message) message.textContent = "LOCATING...";

      try {
        const { data, error } = await supabase.from("orders").select("*").eq("order_number", orderNo).maybeSingle();
        if (error || !data) throw new Error("Order not found.");

        const dbPhone = String(data.customer_phone || "").replace(/\D/g, "");
        if (phone.slice(-10) !== dbPhone.slice(-10)) throw new Error("Phone number mismatch.");

        form.hidden = true;
        result.hidden = false;
        $("[data-track-result-number]").textContent = data.order_number;
        $("[data-track-result-status]").textContent = data.order_status || "PLACED";
        $("[data-track-result-courier]").textContent = data.courier || "In Dispatch Preparation";
        $("[data-track-result-tracking]").textContent = data.tracking_number || "Will update on dispatch";
        if (message) message.textContent = "";
      } catch (err) {
        if (message) message.textContent = err.message || "Failed to locate order.";
      }
    });
  }

  /* --- WAITLIST --- */
  function initWaitlist() {
    const form = $("[data-waitlist-form]");
    const msg = $("[data-waitlist-message]");
    on(form, "submit", (e) => {
      e.preventDefault();
      const input = $("#waitlist-email");
      if (input && input.value.trim() && msg) {
        msg.textContent = "Thank you. You are on the VIP access list.";
        msg.style.color = "#31c48d";
        form.reset();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMobileDrawer();
    initSearch();
    initCarousel();
    initModals();
    initTracking();
    initWaitlist();
  });
})();
