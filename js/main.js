/**
 * BULKKOT — Production Main Storefront Controller
 * Version: 3.7 (Fully Wired Navigation, Search & Modals)
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  let liveProducts = [];
  const selectedSizes = {};
  let activeCategory = "all";
  let activeSearch = "";
  let activeSort = "featured";

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(val) {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
  }

  function getStock(product, size) {
    return Math.max(0, Number(product?.stock?.[size] || 0));
  }

  function getTotalStock(product) {
    const stock = product?.stock || {};
    return ["S", "M", "L", "XL"].reduce((tot, s) => tot + Number(stock[s] || 0), 0);
  }

  function getCategory(product) {
    return String(product?.category || "tees").trim().toLowerCase();
  }

  function getStockBadge(product, size) {
    const stock = getStock(product, size);
    if (stock <= 0) return { text: "SOLD OUT", cls: "is-sold-out", disabled: true };
    if (stock <= 2) return { text: `ONLY ${stock} LEFT`, cls: "is-low", disabled: false };
    return { text: "", cls: "", disabled: false };
  }

  // NAVIGATION & MODALS INIT
  function initNavigation() {
    const mobileDrawer = document.querySelector("[data-mobile-drawer]");
    const openDrawerBtn = document.querySelector("[data-open-drawer]");
    const closeDrawerBtns = document.querySelectorAll("[data-close-drawer]");

    function openDrawer() {
      mobileDrawer?.classList.add("is-open");
      mobileDrawer?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeDrawer() {
      mobileDrawer?.classList.remove("is-open");
      mobileDrawer?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    openDrawerBtn?.addEventListener("click", openDrawer);
    closeDrawerBtns.forEach(btn => btn.addEventListener("click", closeDrawer));

    // Search modal wiring
    const searchModal = document.querySelector("[data-search-modal]");
    const openSearchBtns = document.querySelectorAll("[data-open-search]");
    const closeSearchBtn = searchModal?.querySelector(".drawer-close");
    const searchForm = document.querySelector("[data-search-form]");

    openSearchBtns.forEach(btn => btn.addEventListener("click", () => {
      searchModal?.classList.add("is-open");
      searchModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      setTimeout(() => searchModal?.querySelector("input")?.focus(), 50);
    }));

    closeSearchBtn?.addEventListener("click", () => {
      searchModal?.classList.remove("is-open");
      searchModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    });

    searchForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = searchForm.querySelector("input")?.value.trim().toLowerCase() || "";
      activeSearch = query;
      searchModal?.classList.remove("is-open");
      searchModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      renderProducts(getFilteredProducts());
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    });

    // About story modal wiring
    const aboutModal = document.querySelector("[data-about-modal]");
    const openAboutBtns = document.querySelectorAll("[data-open-about]");
    const closeAboutBtn = aboutModal?.querySelector(".drawer-close");

    openAboutBtns.forEach(btn => btn.addEventListener("click", () => {
      aboutModal?.classList.add("is-open");
      aboutModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }));

    closeAboutBtn?.addEventListener("click", () => {
      aboutModal?.classList.remove("is-open");
      aboutModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    });

    aboutModal?.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.remove("is-open");
        aboutModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
      }
    });

    // Waitlist form wiring
    const waitlistForm = document.querySelector("[data-waitlist-form]");
    waitlistForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = waitlistForm.querySelector("#waitlist-email");
      const msgDiv = waitlistForm.querySelector("[data-waitlist-message]");
      const email = emailInput?.value.trim().toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (msgDiv) { msgDiv.textContent = "Please enter a valid email address."; msgDiv.style.color = "#ff6b6b"; }
        return;
      }

      if (!supabase) return;

      try {
        const { error } = await supabase.from("waitlist").insert({ email });
        if (error) {
          if (error.code === "23505") {
            if (msgDiv) { msgDiv.textContent = "You're already on the VIP waitlist."; msgDiv.style.color = "#f5c542"; }
          } else {
            throw error;
          }
        } else {
          if (msgDiv) { msgDiv.textContent = "Successfully joined the VIP waitlist."; msgDiv.style.color = "#8fe3a8"; }
          emailInput.value = "";
        }
      } catch (err) {
        if (msgDiv) { msgDiv.textContent = "Unable to join right now. Try again later."; msgDiv.style.color = "#ff6b6b"; }
      }
    });
  }

  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!supabase) {
      grid.innerHTML = '<p class="catalog-message">Database offline.</p>';
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      liveProducts = data || [];

      liveProducts.forEach(p => {
        const sizes = ["S", "M", "L", "XL"];
        selectedSizes[p.id] = sizes.find(s => getStock(p, s) > 0) || "M";
      });

      renderProducts(getFilteredProducts());
    } catch (err) {
      console.error("BULKKOT Catalog Error:", err);
      grid.innerHTML = '<p class="catalog-message catalog-message--error">Failed to load catalog.</p>';
    }
  }

  function getFilteredProducts() {
    let list = [...liveProducts];
    if (activeCategory !== "all") {
      list = list.filter(p => getCategory(p) === activeCategory.toLowerCase());
    }
    if (activeSearch) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(activeSearch));
    }
    if (activeSort === "price-low") list.sort((a, b) => Number(a.price) - Number(b.price));
    if (activeSort === "price-high") list.sort((a, b) => Number(b.price) - Number(a.price));
    if (activeSort === "newest") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }

  function renderProducts(items) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<p class="catalog-message" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">No garments found matching your filter.</p>';
      return;
    }

    grid.innerHTML = items.map(p => {
      const cat = getCategory(p);
      const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
      const totalStock = getTotalStock(p);
      const curSize = selectedSizes[p.id] || "M";
      const badge = getStockBadge(p, curSize);

      const sizePills = ["S", "M", "L", "XL"].map(s => {
        const qty = getStock(p, s);
        const sel = curSize === s;
        return `
          <button type="button" 
            class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}" 
            data-action="size" data-id="${p.id}" data-size="${s}">
            ${s}
          </button>
        `;
      }).join('');

      return `
        <article class="product-card" data-product-card data-category="${cat}">
          <div class="product-card__thumb" data-action="view" data-id="${p.id}" style="cursor: pointer;">
            <img src="${escapeHTML(p.image_url || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}" alt="${escapeHTML(p.name)}" loading="lazy">
            <span class="product-status">${totalStock <= 0 ? 'SOLD OUT' : 'DROP 001'}</span>
          </div>
          <div class="product-information">
            <div class="product-information__header" data-action="view" data-id="${p.id}" style="cursor: pointer;">
              <div>
                <h3>${escapeHTML(p.name)}</h3>
                <p class="product-category">${catKorean}</p>
              </div>
              <span class="product-price">${formatPrice(p.price)}</span>
            </div>
            
            <div class="product-sizes-row">
              <div class="product-sizes">${sizePills}</div>
              <span class="product-stock ${badge.cls}">${badge.text}</span>
            </div>

            <button type="button" class="button button--primary product-add-button" 
              data-action="add" data-id="${p.id}" ${badge.disabled ? 'disabled' : ''}>
              ${badge.disabled ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const p = liveProducts.find(item => String(item.id) === String(id));

    if (action === "size" && p) {
      selectedSizes[id] = btn.dataset.size;
      renderProducts(getFilteredProducts());
    } else if (action === "add" && p) {
      const size = selectedSizes[id] || "M";
      if (getStock(p, size) <= 0) return;

      if (window.BULKKOT_CART && typeof window.BULKKOT_CART.addItem === "function") {
        window.BULKKOT_CART.addItem({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          size: size,
          image: p.image_url
        });
      }
    } else if (action === "view" && p) {
      openProductModal(p);
    }
  });

  function openProductModal(p) {
    let modal = document.getElementById("product-detail-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "product-detail-modal";
      modal.className = "content-modal";
      document.body.appendChild(modal);
    }

    const curSize = selectedSizes[p.id] || "M";
    const badge = getStockBadge(p, curSize);

    modal.innerHTML = `
      <div class="content-modal__panel product-modal-box">
        <button type="button" class="drawer-close" id="closeDetailModal" style="position: absolute; right: 16px; top: 16px; z-index: 10;">×</button>
        <div class="product-modal-grid">
          <div class="product-modal-img">
            <img src="${escapeHTML(p.image_url || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}" alt="${escapeHTML(p.name)}">
          </div>
          <div class="product-modal-details">
            <p class="eyebrow">${escapeHTML(p.category || 'ESSENTIALS')}</p>
            <h2>${escapeHTML(p.name)}</h2>
            <div class="product-modal-price">${formatPrice(p.price)}</div>
            <p class="product-modal-desc">${escapeHTML(p.description || 'Korean-inspired heavyweight minimalist everyday wear. Relaxed drop-shoulder cut.')}</p>
            
            <div style="margin: 24px 0 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <p style="font-size:11px; font-weight:700; letter-spacing:0.1em; color:#aaa; margin:0;">SELECT SIZE</p>
                <button type="button" class="modal-size-guide-link" data-size-guide-open style="background:transparent; border:0; color:var(--bk-red); font-size:10px; font-weight:700; cursor:pointer; letter-spacing:0.08em;">SIZE GUIDE ↗</button>
              </div>
              <div class="product-sizes-row">
                <div class="product-sizes">
                  ${["S", "M", "L", "XL"].map(s => {
                    const qty = getStock(p, s);
                    const sel = curSize === s;
                    return `
                      <button type="button" class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}"
                        data-modal-size="${s}">
                        ${s}
                      </button>
                    `;
                  }).join('')}
                </div>
                <span class="product-stock ${badge.cls}">${badge.text}</span>
              </div>
            </div>

            <button type="button" class="button button--primary" id="modalAddToCart" style="width:100%; padding:14px;" ${badge.disabled ? 'disabled' : ''}>
              ${badge.disabled ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    modal.querySelector("#closeDetailModal").onclick = () => closeModal(modal);
    modal.onclick = (e) => { if (e.target === modal) closeModal(modal); };

    modal.querySelectorAll("[data-modal-size]").forEach(b => {
      b.onclick = () => {
        selectedSizes[p.id] = b.dataset.modalSize;
        openProductModal(p);
      };
    });

    modal.querySelector("#modalAddToCart").onclick = () => {
      if (badge.disabled) return;
      if (window.BULKKOT_CART) {
        window.BULKKOT_CART.addItem({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          size: selectedSizes[p.id] || "M",
          image: p.image_url
        });
      }
      closeModal(modal);
    };

    modal.querySelector("[data-size-guide-open]")?.addEventListener("click", () => {
      openSizeGuideModal();
    });
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function initSizeGuide() {
    const modal = document.querySelector("[data-size-guide-modal]");
    if (!modal) return;

    const openButtons = document.querySelectorAll("[data-size-guide-open]");
    const closeButtons = modal.querySelectorAll("[data-size-guide-close]");
    const tabs = modal.querySelectorAll("[data-size-guide-tab]");
    const panels = modal.querySelectorAll("[data-size-guide-panel]");

    function switchTab(category) {
      tabs.forEach(tab => {
        const active = tab.dataset.sizeGuideTab === category;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });

      panels.forEach(panel => {
        const active = panel.dataset.sizeGuidePanel === category;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    }

    openButtons.forEach(b => b.addEventListener("click", openSizeGuideModal));
    closeButtons.forEach(b => b.addEventListener("click", closeSizeGuideModal));

    tabs.forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.sizeGuideTab));
    });
  }

  function openSizeGuideModal() {
    const modal = document.querySelector("[data-size-guide-modal]");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeSizeGuideModal() {
    const modal = document.querySelector("[data-size-guide-modal]");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".content-modal.is-open") && !document.querySelector(".cart-drawer.is-open") && !document.querySelector(".size-guide-modal.is-open") && !document.querySelector(".track-order-modal.is-open") && !document.querySelector(".account-modal.is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  // GUEST ORDER TRACKING
  function initOrderTracking() {
    const modal = document.querySelector("[data-track-order-modal]");
    const form = document.querySelector("[data-track-order-form]");
    const result = document.querySelector("[data-track-order-result]");
    const message = document.querySelector("[data-track-order-message]");

    if (!modal || !form || !supabase) return;

    const orderInput = document.getElementById("track-order-number");
    const phoneInput = document.getElementById("track-order-phone");

    const openButtons = document.querySelectorAll("[data-open-track-order]");
    const closeButtons = modal.querySelectorAll("[data-track-order-close]");
    const againButton = modal.querySelector("[data-track-again]");

    const resultNumber = modal.querySelector("[data-track-result-number]");
    const resultStatus = modal.querySelector("[data-track-result-status]");
    const resultPayment = modal.querySelector("[data-track-result-payment]");
    const resultPaymentStatus = modal.querySelector("[data-track-result-payment-status]");
    const resultCourier = modal.querySelector("[data-track-result-courier]");
    const resultTracking = modal.querySelector("[data-track-result-tracking]");

    const courierRow = modal.querySelector("[data-track-courier-row]");
    const trackingRow = modal.querySelector("[data-track-tracking-row]");
    const cancelledBox = modal.querySelector("[data-track-cancelled]");
    const progressLine = modal.querySelector("[data-track-progress-line]");

    const steps = Array.from(modal.querySelectorAll("[data-track-step]"));

    const STATUS_ORDER = [
      "ORDER PLACED",
      "PAYMENT CONFIRMED",
      "PACKED",
      "SHIPPED",
      "OUT FOR DELIVERY",
      "DELIVERED"
    ];

    function setMessage(text, type = "") {
      if (!message) return;
      message.textContent = text || "";
      message.className = "track-order-message";
      if (type) message.classList.add(`is-${type}`);
    }

    function resetResult() {
      if (!result) return;
      result.hidden = true;
      cancelledBox.hidden = true;
      courierRow.hidden = true;
      trackingRow.hidden = true;
      if (progressLine) progressLine.style.width = "0%";
      steps.forEach(step => step.classList.remove("is-complete", "is-current", "is-cancelled"));
      if (resultStatus) {
        resultStatus.textContent = "ORDER PLACED";
        resultStatus.className = "track-order-status-badge";
      }
      setMessage("");
    }

    function openTrackingModal() {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      resetResult();
      setTimeout(() => orderInput?.focus(), 100);
    }

    function closeTrackingModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      if (!document.querySelector(".content-modal.is-open") && !document.querySelector(".cart-drawer.is-open") && !document.querySelector(".size-guide-modal.is-open") && !document.querySelector(".account-modal.is-open")) {
        document.body.classList.remove("modal-open");
      }
    }

    function renderProgress(status) {
      const normalizedStatus = String(status || "").trim().toUpperCase();

      if (normalizedStatus === "CANCELLED") {
        cancelledBox.hidden = false;
        steps.forEach(step => {
          step.classList.remove("is-complete", "is-current");
          step.classList.add("is-cancelled");
        });
        if (progressLine) progressLine.style.width = "0%";
        return;
      }

      cancelledBox.hidden = true;
      const currentIndex = STATUS_ORDER.indexOf(normalizedStatus);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

      steps.forEach((step, index) => {
        step.classList.remove("is-complete", "is-current", "is-cancelled");
        if (index < safeIndex) step.classList.add("is-complete");
        if (index === safeIndex) step.classList.add("is-current");
      });

      const percentage = STATUS_ORDER.length <= 1 ? 0 : (safeIndex / (STATUS_ORDER.length - 1)) * 100;
      if (progressLine) progressLine.style.width = `${percentage}%`;
    }

    function renderResult(order) {
      const status = String(order.order_status || "ORDER PLACED").trim().toUpperCase();
      resultNumber.textContent = order.order_number || "—";
      resultStatus.textContent = status;
      resultStatus.className = "track-order-status-badge";

      if (status === "CANCELLED") {
        resultStatus.classList.add("is-cancelled");
      } else if (status === "DELIVERED") {
        resultStatus.classList.add("is-delivered");
      } else {
        resultStatus.classList.add("is-active");
      }

      resultPayment.textContent = String(order.payment_method || "COD").toUpperCase();
      resultPaymentStatus.textContent = String(order.payment_status || "PENDING").toUpperCase();

      if (order.courier) {
        courierRow.hidden = false;
        resultCourier.textContent = String(order.courier);
      } else {
        courierRow.hidden = true;
      }

      if (order.tracking_number) {
        trackingRow.hidden = false;
        resultTracking.textContent = String(order.tracking_number);
      } else {
        trackingRow.hidden = true;
      }

      renderProgress(status);
      result.hidden = false;
      setMessage("");
    }

    async function lookupOrder(orderNumber, phone) {
      const normOrder = String(orderNumber || "").trim().toUpperCase();
      const normPhone = String(phone || "").replace(/\D/g, "");

      if (!normOrder) {
        setMessage("Please enter your order number.", "error");
        orderInput?.focus();
        return;
      }

      if (!/^BK-\d{4}-\d{4}$/.test(normOrder)) {
        setMessage("Format must be BK-YYYY-XXXX (e.g. BK-2026-0001).", "error");
        orderInput?.focus();
        return;
      }

      if (!normPhone) {
        setMessage("Please enter the 10-digit phone number.", "error");
        phoneInput?.focus();
        return;
      }

      setMessage("Searching order...", "loading");
      const submitBtn = form.querySelector(".track-order-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "CHECKING...";
      }

      try {
        const { data, error } = await supabase.rpc("track_order", {
          p_order_number: normOrder,
          p_phone: normPhone
        });

        if (error) throw error;

        if (!data || data.success !== true) {
          resetResult();
          setMessage(data?.message || "Order not found. Please verify details.", "error");
          return;
        }

        renderResult(data);
      } catch (err) {
        console.error("Tracking error:", err);
        resetResult();
        setMessage("Unable to check order status right now.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "TRACK ORDER";
        }
      }
    }

    openButtons.forEach(b => b.addEventListener("click", openTrackingModal));
    closeButtons.forEach(b => b.addEventListener("click", closeTrackingModal));

    againButton?.addEventListener("click", () => {
      resetResult();
      form.reset();
      setTimeout(() => orderInput?.focus(), 50);
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      lookupOrder(orderInput?.value, phoneInput?.value);
    });

    orderInput?.addEventListener("input", () => {
      orderInput.value = orderInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    });

    modal.addEventListener("click", e => {
      if (e.target === modal) closeTrackingModal();
    });
  }

  // CUSTOMER AUTH + ACCOUNT
  function initCustomerAuth() {
    const modal = document.querySelector("[data-account-modal]");
    if (!modal || !supabase) return;

    const authView = modal.querySelector("[data-account-auth]");
    const userView = modal.querySelector("[data-account-user]");
    const loginForm = modal.querySelector("[data-account-login-form]");
    const profileForm = modal.querySelector("[data-account-profile-form]");
    const message = modal.querySelector("[data-account-message]");
    const profileMessage = modal.querySelector("[data-profile-message]");

    const emailInput = modal.querySelector("#account-email");
    const passwordInput = modal.querySelector("#account-password");
    const userEmail = modal.querySelector("[data-account-user-email]");
    const ordersContainer = modal.querySelector("[data-account-orders]");

    const openButtons = document.querySelectorAll("[data-open-account]");
    const closeButtons = modal.querySelectorAll("[data-account-close]");
    const googleButton = modal.querySelector("[data-google-login]");
    const signOutButton = modal.querySelector("[data-account-signout]");
    const signupToggle = modal.querySelector("[data-account-signup-toggle]");

    const profileFields = {
      full_name: modal.querySelector("#account-name"),
      phone: modal.querySelector("#account-phone"),
      shipping_address: modal.querySelector("#account-address"),
      shipping_city: modal.querySelector("#account-city"),
      shipping_state: modal.querySelector("#account-state"),
      shipping_pincode: modal.querySelector("#account-pincode")
    };

    let isSignupMode = false;

    function setMessage(element, text = "", type = "") {
      if (!element) return;
      element.textContent = text;
      element.className = "account-message";
      if (type) element.classList.add(`is-${type}`);
    }

    function openAccount() {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeAccount() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      if (
        !document.querySelector(".content-modal.is-open") &&
        !document.querySelector(".cart-drawer.is-open") &&
        !document.querySelector(".size-guide-modal.is-open") &&
        !document.querySelector(".track-order-modal.is-open")
      ) {
        document.body.classList.remove("modal-open");
      }
    }

    function updateHeader(user) {
      document.querySelectorAll("[data-account-label]").forEach(el => {
        el.textContent = user ? "ACCOUNT" : "SIGN IN";
      });
    }

    function showAuthView() {
      authView.hidden = false;
      userView.hidden = true;
    }

    function showUserView() {
      authView.hidden = true;
      userView.hidden = false;
    }

    async function loadProfile(user) {
      if (!user) return;
      const { data, error } = await supabase
        .from("customer_profiles")
        .select("full_name, phone, shipping_address, shipping_city, shipping_state, shipping_pincode")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("BULKKOT Profile Error:", error);
        return;
      }

      const profile = data || {};
      Object.entries(profileFields).forEach(([key, el]) => {
        if (el) el.value = profile[key] || "";
      });
      userEmail.textContent = user.email || "Account";
    }

    function formatDate(date) {
      if (!date) return "—";
      return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
    }

    function formatCurrency(val) {
      return "₹" + Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    }

    async function loadOrders(user) {
      if (!user || !ordersContainer) return;
      ordersContainer.innerHTML = '<div class="account-orders-loading">Loading orders...</div>';

      const { data, error } = await supabase
        .from("orders")
        .select("order_number, total, order_status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("BULKKOT Orders Error:", error);
        ordersContainer.innerHTML = '<div class="account-orders-empty">Unable to load your orders right now.</div>';
        return;
      }

      if (!data || !data.length) {
        ordersContainer.innerHTML = '<div class="account-orders-empty">No orders found on this account yet.</div>';
        return;
      }

      ordersContainer.innerHTML = data.map(order => {
        const status = String(order.order_status || "ORDER PLACED").toUpperCase();
        return `
          <article class="account-order-card">
            <div class="account-order-card__top">
              <div>
                <div class="account-order-number">${escapeHTML(order.order_number || "—")}</div>
                <div class="account-order-date">${escapeHTML(formatDate(order.created_at))}</div>
              </div>
              <span class="account-order-status">${escapeHTML(status)}</span>
            </div>
            <div class="account-order-total">${escapeHTML(formatCurrency(order.total))}</div>
          </article>
        `;
      }).join("");
    }

    async function loadAccount(user) {
      if (!user) return;
      updateHeader(user);
      showUserView();
      await Promise.all([loadProfile(user), loadOrders(user)]);
    }

    async function handleLogin(e) {
      e.preventDefault();
      const email = String(emailInput?.value || "").trim();
      const password = String(passwordInput?.value || "");

      if (!email || !password) {
        setMessage(message, "Please enter your email and password.", "error");
        return;
      }

      const submitBtn = loginForm.querySelector(".account-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = isSignupMode ? "CREATING..." : "SIGNING IN...";
      }

      setMessage(message, isSignupMode ? "Creating your account..." : "Signing you in...", "loading");

      try {
        if (isSignupMode) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: "" } }
          });
          if (error) throw error;
          setMessage(message, "Account created successfully.", "success");
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          setMessage(message, "");
        }
      } catch (err) {
        console.error("BULKKOT Auth Error:", err);
        setMessage(message, err?.message || "Unable to sign in right now.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = isSignupMode ? "CREATE ACCOUNT" : "SIGN IN";
        }
      }
    }

    async function handleGoogleLogin() {
      setMessage(message, "Opening Google sign in...", "loading");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) {
        setMessage(message, error.message || "Unable to continue with Google.", "error");
      }
    }

    async function saveProfile(e) {
      e.preventDefault();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showAuthView();
        return;
      }

      setMessage(profileMessage, "Saving your details...", "loading");

      const payload = {
        id: user.id,
        full_name: profileFields.full_name?.value.trim() || null,
        phone: profileFields.phone?.value.trim() || null,
        shipping_address: profileFields.shipping_address?.value.trim() || null,
        shipping_city: profileFields.shipping_city?.value.trim() || null,
        shipping_state: profileFields.shipping_state?.value.trim() || null,
        shipping_pincode: profileFields.shipping_pincode?.value.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("customer_profiles").upsert(payload, { onConflict: "id" });

      if (error) {
        setMessage(profileMessage, "Unable to save your details.", "error");
        return;
      }

      setMessage(profileMessage, "Shipping details saved.", "success");
    }

    async function signOut() {
      await supabase.auth.signOut();
      closeAccount();
    }

    function toggleSignup() {
      isSignupMode = !isSignupMode;
      const title = modal.querySelector(".account-header h2");
      const submitBtn = loginForm.querySelector(".account-submit");

      if (isSignupMode) {
        title.textContent = "CREATE ACCOUNT";
        submitBtn.textContent = "CREATE ACCOUNT";
        signupToggle.textContent = "SIGN IN";
      } else {
        title.textContent = "SIGN IN";
        submitBtn.textContent = "SIGN IN";
        signupToggle.textContent = "CREATE ACCOUNT";
      }
      setMessage(message, "");
    }

    openButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        openAccount();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await loadAccount(user);
        } else {
          updateHeader(null);
          showAuthView();
        }
      });
    });

    closeButtons.forEach(btn => btn.addEventListener("click", closeAccount));
    modal.addEventListener("click", e => { if (e.target === modal) closeAccount(); });
    loginForm?.addEventListener("submit", handleLogin);
    googleButton?.addEventListener("click", handleGoogleLogin);
    profileForm?.addEventListener("submit", saveProfile);
    signOutButton?.addEventListener("click", signOut);
    signupToggle?.addEventListener("click", toggleSignup);

    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      updateHeader(user);
      if (user && event === "SIGNED_IN") {
        await loadAccount(user);
      } else if (!user) {
        showAuthView();
      }
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      updateHeader(user);
      if (user) {
        await loadAccount(user);
      } else {
        showAuthView();
      }
    });
  }

  // Editorial Carousel
  function initCarousel() {
    const carousel = document.querySelector('[data-carousel]');
    if (!carousel) return;
    const track = carousel.querySelector('[data-carousel-track]');
    const slides = carousel.querySelectorAll('[data-slide]');
    const prevBtn = carousel.querySelector('[data-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-carousel-next]');
    const dots = carousel.querySelectorAll('[data-carousel-dot]');
    let currentIndex = 0;

    function updateCarousel(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;
      currentIndex = index;
      if (track) track.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === currentIndex));
    }

    prevBtn?.addEventListener('click', () => updateCarousel(currentIndex - 1));
    nextBtn?.addEventListener('click', () => updateCarousel(currentIndex + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => updateCarousel(i)));
    updateCarousel(0);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initCatalog();
    initCarousel();
    initSizeGuide();
    initOrderTracking();
    initCustomerAuth();

    document.querySelectorAll("[data-shop-category]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-shop-category]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeCategory = btn.dataset.shopCategory;
        renderProducts(getFilteredProducts());
      });
    });

    document.querySelectorAll(".category-card[data-category]").forEach(card => {
      card.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = card.dataset.category;
        document.querySelectorAll("[data-shop-category]").forEach(b => {
          b.classList.toggle("is-active", b.dataset.shopCategory.toLowerCase() === cat.toLowerCase());
        });
        activeCategory = cat;
        renderProducts(getFilteredProducts());
        document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
      });
    });

    const sortSelect = document.getElementById("shop-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        activeSort = sortSelect.value;
        renderProducts(getFilteredProducts());
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".content-modal.is-open").forEach(closeModal);
        closeSizeGuideModal();
        const trackingModal = document.querySelector("[data-track-order-modal]");
        if (trackingModal?.classList.contains("is-open")) {
          trackingModal.classList.remove("is-open");
          trackingModal.setAttribute("aria-hidden", "true");
          document.body.classList.remove("modal-open");
        }
        const accountModal = document.querySelector("[data-account-modal]");
        if (accountModal?.classList.contains("is-open")) {
          accountModal.classList.remove("is-open");
          accountModal.setAttribute("aria-hidden", "true");
          document.body.classList.remove("modal-open");
        }
        const searchModal = document.querySelector("[data-search-modal]");
        if (searchModal?.classList.contains("is-open")) {
          searchModal.classList.remove("is-open");
          searchModal.setAttribute("aria-hidden", "true");
          document.body.classList.remove("modal-open");
        }
        const aboutModal = document.querySelector("[data-about-modal]");
        if (aboutModal?.classList.contains("is-open")) {
          aboutModal.classList.remove("is-open");
          aboutModal.setAttribute("aria-hidden", "true");
          document.body.classList.remove("modal-open");
        }
      }
    });
  });
})();
/* =========================================================
   BULKKOT — SITE CMS ENGINE
========================================================= */
const BULKKOT_CMS = (() => {
  let content = {};
  let realtimeChannel = null;

  async function load() {
    if (!supabase) return {};
    const { data, error } = await supabase
      .from("site_content")
      .select("content_key, content_value, image_url, content_type, section, updated_at");

    if (error) {
      console.error("BULKKOT CMS load error:", error);
      return {};
    }

    content = {};
    (data || []).forEach(item => {
      content[item.content_key] = {
        value: item.content_value || "",
        image: item.image_url || "",
        type: item.content_type || "text",
        section: item.section || "general"
      };
    });
    return content;
  }

  function get(key, fallback = "") {
    const item = content[key];
    if (!item) return fallback;
    if (item.type === "image") return item.image || fallback;
    return item.value || fallback;
  }

  function setText(selector, key) {
    const el = document.querySelector(selector);
    if (!el) return;
    const val = get(key);
    if (val !== "") el.textContent = val;
  }

  function setLink(selector, key) {
    const el = document.querySelector(selector);
    if (!el) return;
    const val = get(key);
    if (val !== "") el.setAttribute("href", val);
  }

  function setImage(selector, key) {
    const img = document.querySelector(selector);
    if (!img) return;
    const val = get(key);
    if (val) img.src = val;
  }

  function bindAll() {
    // Ticker
    const track = document.querySelector(".announcement-track");
    if (track) {
      const items = [get("announcement_1"), get("announcement_2"), get("announcement_3")].filter(Boolean);
      if (items.length) {
        const doubleList = [...items, ...items];
        track.innerHTML = doubleList.map(t => `<span>${typeof escapeHTML === 'function' ? escapeHTML(t) : t}</span>`).join("");
      }
    }

    // Hero
    setText(".hero-korean", "hero_korean");
    setText(".hero-content h1", "hero_title");
    setText(".hero-label", "hero_subtitle");
    setText(".hero-description", "hero_description");
    setText(".hero-content .button--primary", "hero_button_text");
    setLink(".hero-content .button--primary", "hero_button_link");
    setImage(".hero-image", "hero_image");

    // Collections
    setText(".category-section .eyebrow", "collections_eyebrow");
    setText(".category-section h2", "collections_title");
    
    const cardTees = document.querySelector('.category-card[data-category="tees"]');
    if (cardTees) {
      const t = cardTees.querySelector(".category-name strong"); if (t) t.textContent = get("tees_title", t.textContent);
      const k = cardTees.querySelector(".category-name span"); if (k) k.textContent = get("tees_korean", k.textContent);
      const img = cardTees.querySelector(".category-image img"); if (img && get("tees_image")) img.src = get("tees_image");
    }

    const cardHoods = document.querySelector('.category-card[data-category="hoods"]');
    if (cardHoods) {
      const t = cardHoods.querySelector(".category-name strong"); if (t) t.textContent = get("hoods_title", t.textContent);
      const k = cardHoods.querySelector(".category-name span"); if (k) k.textContent = get("hoods_korean", k.textContent);
      const img = cardHoods.querySelector(".category-image img"); if (img && get("hoods_image")) img.src = get("hoods_image");
    }

    const cardSweats = document.querySelector('.category-card[data-category="sweats"]');
    if (cardSweats) {
      const t = cardSweats.querySelector(".category-name strong"); if (t) t.textContent = get("sweats_title", t.textContent);
      const k = cardSweats.querySelector(".category-name span"); if (k) k.textContent = get("sweats_korean", k.textContent);
      const img = cardSweats.querySelector(".category-image img"); if (img && get("sweats_image")) img.src = get("sweats_image");
    }

    // Drop
    setText("#drop-001 .eyebrow", "drop_eyebrow");
    setText("#drop-001 h2", "drop_title");
    setText("#drop-001 p:not(.eyebrow)", "drop_description");
    setText("#drop-001 a", "drop_button_text");
    setLink("#drop-001 a", "drop_button_link");

    // About
    setText(".about-intro .eyebrow", "about_eyebrow");
    setText(".about-intro h2", "about_korean");
    setText(".about-intro span", "about_title");
    setText(".about-lead", "about_lead");
    const aboutParas = document.querySelectorAll(".about-copy p");
    if (aboutParas[1]) aboutParas[1].textContent = get("about_text_1", aboutParas[1].textContent);
    if (aboutParas[2]) aboutParas[2].textContent = get("about_text_2", aboutParas[2].textContent);
    setText(".about-signature", "about_signature");
    setText("[data-open-about]", "about_button_text");

    // Philosophy
    setText(".philosophy-korean", "philosophy_korean");
    const philHeadings = document.querySelectorAll(".philosophy-section h2, .philosophy-section h3");
    if (philHeadings[0]) philHeadings[0].textContent = get("philosophy_title", philHeadings[0].textContent);
    if (philHeadings[1]) philHeadings[1].textContent = get("philosophy_subtitle", philHeadings[1].textContent);
    setText(".philosophy-section p:last-child", "philosophy_description");

    // Social & Contact
    const igLinks = document.querySelectorAll('a[href*="instagram.com"]');
    const igURL = get("instagram_url");
    if (igURL) igLinks.forEach(l => l.href = igURL);

    const email = get("contact_email");
    if (email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(l => {
        l.href = `mailto:${email}`;
        if (l.textContent.includes("@")) l.textContent = email;
      });
    }

    // Footer
    setText(".footer-brand p:first-of-type", "footer_description");
    setText(".footer-bottom span:first-child", "footer_copyright");
  }

  function subscribe() {
    if (!supabase) return;
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase
      .channel("bulkkot-site-cms")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, async () => {
        await load();
        bindAll();
      })
      .subscribe();
  }

  async function init() {
    await load();
    bindAll();
    subscribe();
  }

  return { init, load, bindAll, get };
})();

// Document Ready listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => BULKKOT_CMS.init());
} else {
  BULKKOT_CMS.init();
}
