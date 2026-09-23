/**
 * BULKKOT (불꽃) — Production Main Storefront Engine
 * Version: 14.0 (Unified Global Router & Zero-Hang Interaction)
 */
(function () {
  'use strict';

  /* =========================================================
     CONFIG & SUPABASE
     ========================================================= */
  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";
  const FALLBACK_IMAGE = "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";
  
  const supabase = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  window.bulkkotSupabase = supabase;

  /* =========================================================
     POLICY DATA
     ========================================================= */
  const POLICY_DATA = {
    faq: {
      title: "FREQUENTLY ASKED QUESTIONS",
      content: `
        <h3>HOW DOES DROP 001 WORK?</h3>
        <p>Drop 001 consists of limited-quantity heavyweight silhouettes. Once sold out, silhouettes will not be restocked immediately.</p>
        <h3>WHAT ARE THE SHIPPING CHARGES?</h3>
        <p>Shipping charges are calculated at checkout based on the current order value and available promotions.</p>
        <h3>WHAT PAYMENT METHODS DO YOU ACCEPT?</h3>
        <p>We accept Cash on Delivery (COD) and standard digital payment methods available at checkout.</p>
      `
    },
    shipping: {
      title: "SHIPPING POLICY",
      content: `
        <h3>DISPATCH TIMELINE</h3>
        <p>Orders are prepared for dispatch within 24-48 hours according to current fulfilment availability.</p>
        <h3>DELIVERY TIMELINE</h3>
        <p>Delivery timelines depend on destination, typically ranging from 3 to 7 business days.</p>
        <h3>REAL-TIME TRACKING</h3>
        <p>Use the Track Order option with your Order Number and registered phone number.</p>
      `
    },
    returns: {
      title: "RETURNS & EXCHANGES",
      content: `
        <h3>EXCHANGE WINDOW</h3>
        <p>Size exchanges are allowed within 7 days of delivery, subject to stock availability.</p>
        <h3>CONDITION</h3>
        <p>Items must retain their original tags, packaging, and remain unworn/unwashed.</p>
      `
    },
    privacy: {
      title: "PRIVACY POLICY",
      content: `
        <h3>DATA COLLECTION</h3>
        <p>Information such as name, phone, email and shipping details is collected solely to process and deliver your order.</p>
        <h3>SECURITY</h3>
        <p>Your data is secured through encrypted databases and will never be shared with third parties.</p>
      `
    },
    terms: {
      title: "TERMS & CONDITIONS",
      content: `
        <h3>PRODUCTS</h3>
        <p>Product availability, pricing, and specifications are subject to the information displayed on the store.</p>
        <h3>CANCELLATION</h3>
        <p>Orders can be cancelled prior to dispatch by contacting our support team.</p>
      `
    }
  };

  /* =========================================================
     HELPERS & SCROLL LOCK
     ========================================================= */
  const $ = (selector, root = document) => root.querySelector(selector);   const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function lockBody() {
    document.body.classList.add("modal-open");
  }

  function unlockBody() {
    const hasOpenModal = document.querySelector('.is-open[data-about-modal], .is-open[data-policy-modal], .is-open[data-size-guide-modal], .is-open[data-track-order-modal], .is-open[data-account-modal], .is-open[data-mobile-drawer], .is-open.pdp-modal, .is-open.cart-drawer');
    if (!hasOpenModal) {
      document.body.classList.remove("modal-open", "drawer-open");
    }
  }

  function formatPrice(val) {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
  }

  function escapeHTML(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* =========================================================
     GLOBAL UI ROUTER (FIXES ALL HANGING BUTTONS)
     ========================================================= */
  function initGlobalRouter() {
    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      // 1. MOBILE DRAWER
      if (target.closest("[data-open-drawer], #headerMenuToggle")) {
        e.preventDefault();
        const drawer = $("[data-mobile-drawer]") \vert{}\vert{} $("#mobile-drawer");
        const overlay = $("[data-mobile-overlay]") \vert{}\vert{} $(".drawer-overlay");
        drawer?.classList.add("is-open");
        drawer?.setAttribute("aria-hidden", "false");
        overlay?.classList.add("is-active", "is-visible");
        document.body.classList.add("drawer-open");
        lockBody();
        return;
      }
      if (target.closest("[data-close-drawer], #closeMobileDrawerBtn") || (target.matches("[data-mobile-overlay].is-visible"))) {
        e.preventDefault();
        const drawer = $("[data-mobile-drawer]") \vert{}\vert{} $("#mobile-drawer");
        const overlay = $("[data-mobile-overlay]") \vert{}\vert{} $(".drawer-overlay");
        drawer?.classList.remove("is-open");
        drawer?.setAttribute("aria-hidden", "true");
        overlay?.classList.remove("is-active", "is-visible");
        document.body.classList.remove("drawer-open");
        unlockBody();
        return;
      }
      if (target.closest(".mobile-navigation a")) {
        // Auto-close drawer on link click
        $("[data-mobile-drawer]")?.classList.remove("is-open");
        $("[data-mobile-overlay]")?.classList.remove("is-active", "is-visible");
        document.body.classList.remove("drawer-open");
        unlockBody();
      }

      // 2. HEADER SEARCH
      if (target.closest("#headerSearchToggle")) {
        e.preventDefault();
        const bar = $("#headerSearchBar");
        bar?.classList.toggle("is-active");
        if (bar?.classList.contains("is-active")) $("#liveSearchInput")?.focus();
        return;
      }
      if (target.closest("#headerSearchClose")) {
        e.preventDefault();
        $("#headerSearchBar")?.classList.remove("is-active");
        return;
      }
      if (target.closest("[data-search-tag]")) {
        const tag = target.closest("[data-search-tag]").dataset.searchTag;
        if (tag) window.location.href = `shop.html?q=${encodeURIComponent(tag)}`;
        return;
      }

      // 3. MODALS OPEN
      const openAccount = target.closest("[data-open-account]");
      const openTrack = target.closest("[data-open-track-order]");
      const openSize = target.closest("[data-size-guide-open]");
      const openAbout = target.closest("[data-open-about]");
      const openPolicy = target.closest("[data-open-policy]");

      if (openAccount || openTrack || openSize || openAbout || openPolicy) {
        e.preventDefault();
        // Close drawer if open
        $("[data-mobile-drawer]")?.classList.remove("is-open");
        $("[data-mobile-overlay]")?.classList.remove("is-active", "is-visible");

        let modal = null;
        if (openAccount) modal = $("[data-account-modal]");
        if (openTrack) {
          modal = $("[data-track-order-modal]");
          if ($("[data-track-order-form]")) $("[data-track-order-form]").hidden = false;
          if ($("[data-track-order-result]")) $("[data-track-order-result]").hidden = true;
          if ($("[data-track-order-message]")) $("[data-track-order-message]").textContent = "";
        }
        if (openSize) modal = $("[data-size-guide-modal]");
        if (openAbout) modal = $("[data-about-modal]");
        if (openPolicy) {
          modal = $("[data-policy-modal]");
          const type = openPolicy.dataset.openPolicy;
          const data = POLICY_DATA[type];
          if (data && modal) {
            const titleEl = $("[data-policy-title]", modal);
            const contentEl = $("[data-policy-content]", modal);
            if (titleEl) titleEl.textContent = data.title;
            if (contentEl) contentEl.innerHTML = data.content;
          }
        }

        if (modal) {
          modal.classList.add("is-open");
          modal.setAttribute("aria-hidden", "false");
          lockBody();
        }
        return;
      }

      // 4. MODALS CLOSE
      const closeModalBtn = target.closest("[data-account-close], [data-track-order-close], [data-size-guide-close], [data-close-policy], [data-close-about], .welcome-close");
      const isBackdropClick = target.matches(".account-backdrop, .track-order-backdrop, .size-guide-backdrop, .pdp-backdrop") || (target.classList.contains('content-modal') && !target.closest('.content-modal__panel')) || target.id === 'welcomePopupModal';
      
      if (closeModalBtn || isBackdropClick) {
        e.preventDefault();
        const activeModal = target.closest(".is-open") || (isBackdropClick ? target : null);
        if (activeModal) {
          activeModal.classList.remove("is-open");
          activeModal.setAttribute("aria-hidden", "true");
          unlockBody();
        }
        return;
      }

      // 5. SIZE GUIDE TABS
      const sizeTab = target.closest("[data-size-tab]");
      if (sizeTab) {
        const modal = sizeTab.closest("[data-size-guide-modal]");
        $$("[data-size-tab]", modal).forEach(t => t.classList.remove("is-active"));         sizeTab.classList.add("is-active");         const targetPanel = sizeTab.dataset.sizeTab;         $$
("[data-size-panel]", modal).forEach(p => {
          const match = p.dataset.sizePanel === targetPanel;
          p.hidden = !match;
          p.classList.toggle("is-active", match);
        });
        return;
      }

      // 6. CART FALLBACK (If cart.js is missing/slow)
      if (target.closest("[data-open-cart]")) {
        if (!window.BULKKOT_CART) {
          e.preventDefault();
          const drawer = $("[data-cart-drawer]") \vert{}\vert{} $("#cart-drawer");
          const overlay = $("[data-cart-overlay]") \vert{}\vert{} $(".drawer-overlay");
          drawer?.classList.add("is-open");
          overlay?.classList.add("is-open", "is-visible");
          lockBody();
        }
      }
    });

    // Header Search Form Submit
    $("#headerSearchForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("#liveSearchInput")?.value.trim();
      if (q) window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
    });

    // Escape Key to close all modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        $$(".is-open").forEach(el => el.classList.remove("is-open"));
        unlockBody();
        if (window.BULKKOT_CART?.closeCart) window.BULKKOT_CART.closeCart();
      }
    });
  }

  /* =========================================================
     FORMS & BACKEND LOGIC (Auth, Tracking, Waitlist)
     ========================================================= */
  function initFormsAndBackend() {
    
    // 1. ORDER TRACKING
    const trackForm = $("[data-track-order-form]");
    const trackMsg = $("[data-track-order-message]");
    const trackResult = $("[data-track-order-result]");
    
    $("[data-track-again]")?.addEventListener("click", () => {
      if (trackResult) trackResult.hidden = true;
      if (trackForm) trackForm.hidden = false;
      if (trackMsg) trackMsg.textContent = "";
    });

    trackForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const orderNo = $("#track-order-number")?.value.trim().toUpperCase();
      const phoneInput = $("#track-order-phone")?.value.trim().replace(/\D/g, "");
      const submitBtn = $(".track-order-submit", trackForm);

      if (!orderNo || !phoneInput) {
        if (trackMsg) { trackMsg.textContent = "Provide both Order Number and Phone."; trackMsg.style.color = "#ff7777"; }
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "LOCATING..."; }
      if (trackMsg) trackMsg.textContent = "";

      try {
        if (!supabase) throw new Error("Database offline.");
        const { data, error } = await supabase.from("orders").select("*").eq("order_number", orderNo).maybeSingle();
        
        if (error || !data) throw new Error("No shipment found matching that Order Number.");
        
        const dbPhone = String(data.customer_phone || "").replace(/\D/g, "");
        if (phoneInput.slice(-10) !== dbPhone.slice(-10)) throw new Error("Phone number mismatch.");

        trackForm.hidden = true;
        trackResult.hidden = false;
        $("[data-track-result-number]").textContent = data.order_number;
        $("[data-track-result-status]").textContent = data.order_status || "PLACED";
        $("[data-track-result-courier]").textContent = data.courier || "In Dispatch Preparation";
        $("[data-track-result-tracking]").textContent = data.tracking_number || "Will update on dispatch";
        
        // Progress Bar Update
        const steps = ["PLACED", "PACKED", "SHIPPED", "OUT FOR DELIVERY", "DELIVERED"];
        const statusStr = (data.order_status || "PLACED").toUpperCase();
        let curIdx = steps.indexOf(statusStr);
        if (curIdx < 0) curIdx = 0;
        
        const pct = Math.max(15, Math.min(100, ((curIdx + 1) / steps.length) * 100));
        const line = $("[data-track-progress-line]");
        if (line) line.style.width = `${pct}%`;

        $$(".track-step", trackResult).forEach(stepEl => {
          const sIdx = steps.indexOf(stepEl.dataset.trackStep);
          stepEl.classList.toggle("is-active", sIdx <= curIdx);
          stepEl.classList.toggle("is-current", sIdx === curIdx);
        });

      } catch (err) {
        if (trackMsg) { trackMsg.textContent = err.message; trackMsg.style.color = "#ff7777"; }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "LOOKUP SHIPMENT"; }
      }
    });

    // 2. WAITLIST
    const waitlistForm = $("[data-waitlist-form]");
    const waitlistMsg = $("[data-waitlist-message]");
    
    waitlistForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#waitlist-email")?.value.trim().toLowerCase();
      const submitBtn = $("button[type='submit']", waitlistForm);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (waitlistMsg) { waitlistMsg.textContent = "Please enter a valid email address."; waitlistMsg.style.color = "#ff7777"; }
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "JOINING..."; }
      
      try {
        if (supabase) {
          const { error } = await supabase.from("waitlist").insert([{ email, source: "homepage" }]);
          if (error && error.code !== "23505" && !/duplicate/i.test(error.message)) throw error;
        }
        if (waitlistMsg) {
          waitlistMsg.textContent = "You're on the list! We'll see you at Drop 001.";
          waitlistMsg.style.color = "#31c48d";
        }
        waitlistForm.reset();
      } catch (err) {
        if (waitlistMsg) { waitlistMsg.textContent = "Something went wrong. Try again."; waitlistMsg.style.color = "#ff7777"; }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "JOIN"; }
      }
    });

    // 3. AUTH, LOGIN, SIGNUP & PROFILE
    async function updateAuthUI(user) {
      const accountLabel = $("[data-account-label]");
      const authView = $("[data-account-auth]");
      const userView = $("[data-account-user]");
      const emailView = $("[data-account-user-email]");

      if (user) {
        const name = user.user_metadata?.full_name || user.email.split('@')[0];
        if (accountLabel) accountLabel.textContent = name.toUpperCase();
        if (authView) authView.hidden = true;
        if (userView) userView.hidden = false;
        if (emailView) emailView.textContent = user.email;
        loadProfileData(user.id);
        loadOrderData(user.id);
      } else {
        if (accountLabel) accountLabel.textContent = "ACCOUNT";
        if (authView) authView.hidden = false;
        if (userView) userView.hidden = true;
      }
    }

    if (supabase) {
      supabase.auth.onAuthStateChange((_event, session) => updateAuthUI(session?.user));
      supabase.auth.getUser().then(({ data }) => updateAuthUI(data?.user));
    }

    const loginForm = $("[data-account-login-form]");
    const signupToggle = $("[data-account-signup-toggle]");
    const modeText = $("#auth-mode-text");
    const nameField = $("#account-name-field");
    const msgEl = $("#authInlineError");

    signupToggle?.addEventListener("click", () => {
      const isSignup = loginForm.dataset.mode === "signup";
      loginForm.dataset.mode = isSignup ? "signin" : "signup";
      if (nameField) nameField.style.display = isSignup ? "none" : "flex";
      if (modeText) modeText.innerHTML = isSignup ? 'Login <span style="font-weight:400;font-size:18px;">or</span> Signup' : 'Create Account';
      signupToggle.innerHTML = isSignup ? 'New to BULKKOT? <strong>Create an account</strong>' : 'Already have an account? <strong>Login here</strong>';
      const submitBtn = $(".account-submit", loginForm);
      if (submitBtn) submitBtn.textContent = isSignup ? "CONTINUE" : "CREATE ACCOUNT";
      if (msgEl) msgEl.textContent = "";
    });

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!supabase) return;
      const email = $("#account-email", loginForm)?.value.trim();
      const password = $("#account-password", loginForm)?.value;
      const fullName = $("#account-name-input", loginForm)?.value.trim();
      const isSignup = loginForm.dataset.mode === "signup";
      const submitBtn = $(".account-submit", loginForm);

      if (!email || !password || (isSignup && !fullName)) {
        if (msgEl) msgEl.textContent = "Fill in all fields.";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "PROCESSING...";
      if (msgEl) msgEl.textContent = "";

      try {
        if (isSignup) {
          const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
          if (error) throw error;
          if (data?.user) await supabase.from("customer_profiles").upsert({ id: data.user.id, full_name: fullName, updated_at: new Date().toISOString() });
          if (msgEl) { msgEl.textContent = "Success!"; msgEl.style.color = "#31c48d"; }
          setTimeout(() => closeModal($("[data-account-modal]")), 800);
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          closeModal($("[data-account-modal]"));
        }
      } catch (err) {
        if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = "#ff7777"; }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignup ? "CREATE ACCOUNT" : "CONTINUE";
      }
    });

    $("[data-google-login]")?.addEventListener("click", async () => {
      if (supabase) await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    });

    $("[data-account-signout]")?.addEventListener("click", async () => {
      if (supabase) {
        $("[data-account-signout]").textContent = "SIGNING OUT...";
        await supabase.auth.signOut();
        $("[data-account-signout]").textContent = "SIGN OUT";
        closeModal($("[data-account-modal]"));
      }
    });

    const profileForm = $("[data-account-profile-form]");
    profileForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileData = {
        id: user.id,
        full_name: $("#account-name", profileForm)?.value.trim() || "",
        phone: $("#account-phone", profileForm)?.value.trim() || "",
        shipping_address: $("#account-address", profileForm)?.value.trim() || "",
        shipping_city: $("#account-city", profileForm)?.value.trim() || "",
        shipping_state: $("#account-state", profileForm)?.value.trim() || "",
        shipping_pincode: $("#account-pincode", profileForm)?.value.trim() || "",
        updated_at: new Date().toISOString()
      };

      const btn = $("button[type='submit']", profileForm);
      const msg = $("[data-profile-message]");
      if (btn) { btn.disabled = true; btn.textContent = "SAVING..."; }
      
      try {
        const { error } = await supabase.from("customer_profiles").upsert(profileData);
        if (error) throw error;
        if (msg) { msg.textContent = "Profile saved successfully!"; msg.style.color = "#31c48d"; }
        setTimeout(() => { if (msg) msg.textContent = ""; }, 3000);
      } catch (err) {
        if (msg) { msg.textContent = err.message || "Failed to save."; msg.style.color = "#ff7777"; }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "SAVE PROFILE"; }
      }
    });

    async function loadProfileData(userId) {
      if (!supabase || !userId) return;
      try {
        const { data } = await supabase.from("customer_profiles").select("*").eq("id", userId).maybeSingle();
        if (!data) return;
        const form = $("[data-account-profile-form]");
        if (!form) return;
        if ($("#account-name", form)) $("#account-name", form).value = data.full_name || "";
        if ($("#account-phone", form)) $("#account-phone", form).value = data.phone || "";
        if ($("#account-address", form)) $("#account-address", form).value = data.shipping_address || "";
        if ($("#account-city", form)) $("#account-city", form).value = data.shipping_city || "";
        if ($("#account-state", form)) $("#account-state", form).value = data.shipping_state || "";
        if ($("#account-pincode", form)) $("#account-pincode", form).value = data.shipping_pincode || "";
      } catch (e) {}
    }

    async function loadOrderData(userId) {
      const box = $("[data-account-orders]");
      if (!box || !supabase) return;
      try {
        const { data, error } = await supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        if (error || !data || !data.length) {
          box.innerHTML = '<p style="color:#777; font-size:12px;">No past orders found.</p>';
          return;
        }
        box.innerHTML = data.map(o => `
          <div style="border:1px solid #222; border-radius:6px; padding:10px; margin-bottom:8px; background:#0c0c0c;">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
              <span>${escapeHTML(o.order_number || o.id.slice(0, 8))}</span>
              <span style="color:var(--bk-red);">${escapeHTML(o.order_status || 'PLACED')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#888; margin-top:4px;">
              <span>${new Date(o.created_at).toLocaleDateString()}</span>
              <strong>${formatPrice(o.total)}</strong>
            </div>
          </div>
        `).join('');
      } catch (e) {
        box.innerHTML = '<p style="color:#777; font-size:12px;">Failed to load history.</p>';
      }
    }
  }

  /* =========================================================
     EDITORIAL CAROUSEL
     ========================================================= */
  function initEditorialCarousel() {
    const container = $("#editorialCarousel");
    if (!container) return;
    const slides = $$(".editorial-slide", container);     const dots = $$(".carousel-indicator", container);
    const prev = $(".carousel-control--prev", container);
    const next = $(".carousel-control--next", container);
    if (!slides.length) return;

    let cur = 0;
    function show(i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => s.classList.toggle("is-active", idx === cur));
      dots.forEach((d, idx) => d.classList.toggle("is-active", idx === cur));
    }
    
    function start() {
      if (state.editorialTimer) clearInterval(state.editorialTimer);
      state.editorialTimer = setInterval(() => show(cur + 1), 5000);
    }

    if (prev) on(prev, "click", () => { show(cur - 1); start(); });
    if (next) on(next, "click", () => { show(cur + 1); start(); });
    dots.forEach((dot, idx) => on(dot, "click", () => { show(idx); start(); }));

    on(container, "mouseenter", () => clearInterval(state.editorialTimer));
    on(container, "mouseleave", start);
    
    show(0);
    start();
  }

  /* =========================================================
     WELCOME POPUP
     ========================================================= */
  function initWelcomePopup() {
    const popup = $("#welcomePopupModal");
    if (!popup || localStorage.getItem(STORAGE_KEYS.welcomeSeen)) return;
    setTimeout(() => {
      popup.classList.add("is-open");
      popup.setAttribute("aria-hidden", "false");
    }, 1500);

    const close = () => {
      popup.classList.remove("is-open");
      localStorage.setItem(STORAGE_KEYS.welcomeSeen, "true");
    };

    on($("#welcomePopupClose"), "click", close);
    on($("#welcomeGoogleBtn"), "click", () => { close(); $("[data-google-login]")?.click(); });
    on($("#welcomeEmailBtn"), "click", () => { close(); $("[data-open-account]")?.click(); });   }    /* =========================================================      STORE SETTINGS SYNC (WHATSAPP/EMAIL)      ========================================================= */   async function syncStoreSettings() {     if (!supabase) return;     try {       const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();       if (!data) return;       const phone = String(data.support_phone \vert{}\vert{} '').replace(/\D/g, '');       if (phone) {         $$(".whatsapp-float").forEach(btn => btn.href = `https://wa.me/${phone}?text=Hi BULKKOT`);
      }
      if (data.support_email) {
        $$('a[href^="mailto:"]').forEach(a => a.href = `mailto:${data.support_email}`);
      }
    } catch (e) {}
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function initStorefront() {
    if (state.initialized) return;
    state.initialized = true;

    initGlobalRouter();
    initFormsAndBackend();
    initEditorialCarousel();
    initWelcomePopup();
    syncStoreSettings();

    /* Make fallback images resilient */
    $$("img").forEach(img => {
      on(img, "error", () => {
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = "true";
          img.src = FALLBACK_IMAGE;
        }
      }, { once: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStorefront);
  } else {
    initStorefront();
  }
})();
