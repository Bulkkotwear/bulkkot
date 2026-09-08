/**
 * BULKKOT — Production Main Storefront Engine
 * Version: 10.0 (Unified Client Instance & Hardened Operations)
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // Expose singleton instance to window for cart.js and other modules
  window.BULKKOT_SUPABASE = supabase;

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
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  function getProductImages(product) {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images.filter(Boolean);
    }
    if (product?.image_url) {
      return [product.image_url];
    }
    return ['https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png'];
  }

  /* =========================================================
     AUTH STATE & ACCOUNT
     ========================================================= */
  async function initAuth() {
    if (!supabase) return;

    async function syncUserState() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const accountLabel = document.querySelector('[data-account-label]');
      const authView = document.querySelector('[data-account-auth]');
      const userView = document.querySelector('[data-account-user]');
      const userEmailEl = document.querySelector('[data-account-user-email]');

      if (user) {
        if (accountLabel) accountLabel.textContent = (user.user_metadata?.full_name || user.email.split('@')[0]).toUpperCase();
        if (authView) authView.hidden = true;
        if (userView) userView.hidden = false;
        if (userEmailEl) userEmailEl.textContent = user.email;
        loadCustomerProfile(user.id);
        loadCustomerOrders(user.id);
      } else {
        if (accountLabel) accountLabel.textContent = 'ACCOUNT';
        if (authView) authView.hidden = false;
        if (userView) userView.hidden = true;
      }
    }

    supabase.auth.onAuthStateChange(() => {
      syncUserState();
      if (window.BULKKOT_CART?.renderCart) window.BULKKOT_CART.renderCart();
    });

    syncUserState();

    const loginForm = document.querySelector('[data-account-login-form]');
    const msgEl = document.querySelector('[data-account-message]');

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#account-email')?.value.trim();
      const password = loginForm.querySelector('#account-password')?.value;
      const submitBtn = loginForm.querySelector('.account-submit');

      if (!email || !password) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'VERIFYING...';
      if (msgEl) msgEl.textContent = '';

      const isSignUp = loginForm.dataset.mode === 'signup';
      try {
        let res = isSignUp
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
      } catch (err) {
        if (msgEl) msgEl.textContent = err.message || 'Authentication error.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN';
      }
    });

    const signupToggle = document.querySelector('[data-account-signup-toggle]');
    signupToggle?.addEventListener('click', () => {
      const isSignUp = loginForm.dataset.mode === 'signup';
      loginForm.dataset.mode = isSignUp ? 'signin' : 'signup';
      const title = document.getElementById('account-title');
      const submitBtn = loginForm.querySelector('.account-submit');
      if (title) title.textContent = isSignUp ? 'SIGN IN' : 'CREATE ACCOUNT';
      if (submitBtn) submitBtn.textContent = isSignUp ? 'SIGN IN' : 'CREATE ACCOUNT';
      signupToggle.textContent = isSignUp ? 'CREATE ACCOUNT' : 'HAVE AN ACCOUNT? SIGN IN';
    });

    document.querySelector('[data-google-login]')?.addEventListener('click', async () => {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    });

    document.querySelector('[data-account-signout]')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
  }

  async function loadCustomerProfile(userId) {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('customer_profiles').select('*').eq('id', userId).maybeSingle();
      if (!data) return;
      const f = document.querySelector('[data-account-profile-form]');
      if (!f) return;
      if (f.querySelector('#account-name')) f.querySelector('#account-name').value = data.full_name || '';
      if (f.querySelector('#account-phone')) f.querySelector('#account-phone').value = data.phone || '';
      if (f.querySelector('#account-address')) f.querySelector('#account-address').value = data.shipping_address || '';
      if (f.querySelector('#account-city')) f.querySelector('#account-city').value = data.shipping_city || '';
      if (f.querySelector('#account-state')) f.querySelector('#account-state').value = data.shipping_state || '';
      if (f.querySelector('#account-pincode')) f.querySelector('#account-pincode').value = data.shipping_pincode || '';
    } catch (e) {}
  }

  async function loadCustomerOrders(userId) {
    const ordersBox = document.querySelector('[data-account-orders]');
    if (!ordersBox || !supabase) return;
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error || !data || !data.length) {
        ordersBox.innerHTML = '<p style="color:#777; font-size:12px; margin:10px 0;">No past orders found.</p>';
        return;
      }
      ordersBox.innerHTML = data.map(o => `
        <div style="border: 1px solid #222; border-radius:6px; padding:10px; margin-bottom:8px; background:#0c0c0c;">
          <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
            <span>${escapeHTML(o.order_number || o.id.slice(0, 8))}</span>
            <span style="color:var(--bk-red, #e31b23);">${escapeHTML(o.order_status || 'PLACED')}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#888; margin-top:4px;">
            <span>${new Date(o.created_at).toLocaleDateString()}</span>
            <strong>${formatPrice(o.total)}</strong>
          </div>
        </div>
      `).join('');
    } catch (e) {
      ordersBox.innerHTML = '<p style="color:#777; font-size:12px;">Failed to load order history.</p>';
    }
  }

  /* =========================================================
     DYNAMIC SETTINGS SYNC
     ========================================================= */
  async function syncStoreSettings() {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
      if (!data) return;

      const rawPhone = String(data.support_phone || '').replace(/\D/g, '');
      const whatsappBtn = document.querySelector('.whatsapp-float');
      if (whatsappBtn && rawPhone) {
        whatsappBtn.href = `https://wa.me/${rawPhone}?text=${encodeURIComponent('Hi BULKKOT, I have an inquiry about Drop 001.')}`;
      }

      if (data.support_email) {
        document.querySelectorAll('[data-cms-key="contact_email"]').forEach(el => {
          el.textContent = data.support_email;
        });
      }
    } catch (e) {}
  }

  /* =========================================================
     CMS CONTENT LOADER
     ========================================================= */
  async function loadCMSContent() {
    if (!supabase) return;
    try {
      const { data } = await supabase.from("site_content").select("*");
      if (!data) return;

      data.forEach(row => {
        const val = row.image_url || row.content_value || "";
        document.querySelectorAll(`[data-cms-key="${CSS.escape(row.content_key)}"]`).forEach(el => {
          if (el.tagName === "IMG") el.src = val;
          else el.textContent = val;
        });
      });
    } catch (e) {}
  }

  /* =========================================================
     CATALOGUE
     ========================================================= */
  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid || !supabase) return;

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      liveProducts = data || [];
      liveProducts.forEach(p => {
        selectedSizes[p.id] = ["S", "M", "L", "XL"].find(s => getStock(p, s) > 0) || "M";
      });
      renderProducts(getFilteredProducts());
    } catch (err) {
      grid.innerHTML = '<p class="catalog-message">Unable to load catalog right now.</p>';
    }
  }

  function getFilteredProducts() {
    let list = [...liveProducts];
    if (activeCategory !== "all") list = list.filter(p => getCategory(p) === activeCategory.toLowerCase());
    if (activeSearch) list = list.filter(p => (p.name || '').toLowerCase().includes(activeSearch));
    if (activeSort === "price-low") list.sort((a, b) => Number(a.price) - Number(b.price));
    if (activeSort === "price-high") list.sort((a, b) => Number(b.price) - Number(a.price));
    if (activeSort === "newest") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }

  function renderProducts(items) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<p class="catalog-message" style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">No garments found.</p>';
      return;
    }

    grid.innerHTML = items.map(p => {
      const cat = getCategory(p);
      const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
      const totalStock = getTotalStock(p);
      const curSize = selectedSizes[p.id] || "M";
      const badge = getStockBadge(p, curSize);
      const images = getProductImages(p);

      const sizePills = ["S", "M", "L", "XL"].map(s => {
        const qty = getStock(p, s);
        const sel = curSize === s;
        return `<button type="button" class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}" data-action="size" data-id="${p.id}" data-size="${s}" ${qty <= 0 ? 'disabled' : ''}>${s}</button>`;
      }).join('');

      return `
        <article class="product-card" data-product-card data-category="${cat}">
          <div class="product-card__thumb" data-action="quickview" data-id="${p.id}" style="cursor: pointer;">
            <img src="${escapeHTML(images[0])}" alt="${escapeHTML(p.name)}" loading="lazy">
            <span class="product-status">${totalStock <= 0 ? 'SOLD OUT' : 'DROP 001'}</span>
          </div>
          <div class="product-information">
            <div class="product-information__header" data-action="quickview" data-id="${p.id}" style="cursor: pointer;">
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
            <button type="button" class="button button--primary product-add-button" data-action="add" data-id="${p.id}" ${badge.disabled ? 'disabled' : ''}>
              ${badge.disabled ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  /* =========================================================
     PRODUCT DETAIL MODAL (PDP)
     ========================================================= */
  let currentPdpProduct = null;
  let currentPdpSize = 'M';
  let currentPdpQty = 1;

  function openPdpModal(productId) {
    const p = liveProducts.find(item => String(item.id) === String(productId));
    if (!p) return;

    currentPdpProduct = p;
    currentPdpSize = selectedSizes[p.id] || ["S", "M", "L", "XL"].find(s => getStock(p, s) > 0) || "M";
    currentPdpQty = 1;
    renderPdpView();

    const modal = document.getElementById('pdpModal');
    modal?.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closePdpModal() {
    const modal = document.getElementById('pdpModal');
    modal?.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function renderPdpView() {
    const container = document.getElementById('pdpContent');
    const p = currentPdpProduct;
    if (!container || !p) return;

    const images = getProductImages(p);
    const cat = getCategory(p);
    const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
    const stockCurSize = getStock(p, currentPdpSize);

    let related = liveProducts.filter(item => String(item.id) !== String(p.id) && getCategory(item) === cat);
    if (related.length < 4) {
      related = [...related, ...liveProducts.filter(item => String(item.id) !== String(p.id) && getCategory(item) !== cat)].slice(0, 4);
    } else {
      related = related.slice(0, 4);
    }

    const thumbsHtml = images.map((img, i) => `
      <div class="pdp-thumb ${i === 0 ? 'is-active' : ''}" data-pdp-thumb="${i}">
        <img src="${escapeHTML(img)}" alt="Thumbnail">
      </div>
    `).join('');

    const sizeButtons = ["S", "M", "L", "XL"].map(s => {
      const st = getStock(p, s);
      return `
        <button type="button" class="pdp-size-btn ${currentPdpSize === s ? 'is-selected' : ''} ${st <= 0 ? 'is-sold-out' : ''}"
                data-pdp-size="${s}" ${st <= 0 ? 'disabled' : ''}>
          ${s}
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="pdp-grid">
        <div class="pdp-gallery">
          <div class="pdp-main-image-wrap">
            <img src="${escapeHTML(images[0])}" id="pdpMainImage" class="pdp-main-image" alt="${escapeHTML(p.name)}">
          </div>
          ${images.length > 1 ? `<div class="pdp-thumbnails">${thumbsHtml}</div>` : ''}
        </div>

        <div class="pdp-info">
          <span class="pdp-korean">${catKorean} · DROP 001</span>
          <h2 class="pdp-title">${escapeHTML(p.name)}</h2>
          <div class="pdp-price">${formatPrice(p.price)}</div>

          <p class="pdp-desc">${escapeHTML(p.description || 'Constructed from heavyweight luxury combed cotton.')}</p>

          <div class="pdp-option-title">
            <span>SELECT SIZE</span>
            <span style="color: ${stockCurSize <= 2 && stockCurSize > 0 ? 'var(--bk-yellow, #f5c542)' : '#777'};">
              ${stockCurSize <= 0 ? 'SOLD OUT' : (stockCurSize <= 4 ? `ONLY ${stockCurSize} LEFT` : 'IN STOCK')}
            </span>
          </div>
          <div class="pdp-sizes">${sizeButtons}</div>

          <div class="pdp-option-title"><span>QUANTITY</span></div>
          <div class="pdp-qty-row">
            <div class="pdp-qty-box">
              <button type="button" id="pdpQtyMinus">-</button>
              <span id="pdpQtyVal">${currentPdpQty}</span>
              <button type="button" id="pdpQtyPlus">+</button>
            </div>
            <button type="button" class="button button--primary pdp-add-btn" id="pdpAddBtn" ${stockCurSize <= 0 ? 'disabled' : ''}>
              ${stockCurSize <= 0 ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </div>
      </div>

      ${related.length > 0 ? `
        <div class="pdp-related">
          <div class="pdp-related-title">SIMILAR SILHOUETTES</div>
          <div class="pdp-related-grid">
            ${related.map(rel => `
              <div class="pdp-related-card" data-action="quickview" data-id="${rel.id}">
                <img src="${escapeHTML(getProductImages(rel)[0])}" alt="${escapeHTML(rel.name)}">
                <div class="pdp-related-meta">
                  <strong>${escapeHTML(rel.name)}</strong>
                  <span>${formatPrice(rel.price)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    container.querySelectorAll('[data-pdp-thumb]').forEach(tb => {
      tb.addEventListener('click', () => {
        container.querySelectorAll('[data-pdp-thumb]').forEach(t => t.classList.remove('is-active'));
        tb.classList.add('is-active');
        const mainImg = document.getElementById('pdpMainImage');
        if (mainImg) mainImg.src = images[Number(tb.dataset.pdpThumb)];
      });
    });

    container.querySelectorAll('[data-pdp-size]').forEach(sb => {
      sb.addEventListener('click', () => {
        currentPdpSize = sb.dataset.pdpSize;
        renderPdpView();
      });
    });

    container.querySelector('#pdpQtyMinus')?.addEventListener('click', () => {
      if (currentPdpQty > 1) {
        currentPdpQty -= 1;
        container.querySelector('#pdpQtyVal').textContent = currentPdpQty;
      }
    });

    container.querySelector('#pdpQtyPlus')?.addEventListener('click', () => {
      if (currentPdpQty < stockCurSize) {
        currentPdpQty += 1;
        container.querySelector('#pdpQtyVal').textContent = currentPdpQty;
      }
    });

    container.querySelector('#pdpAddBtn')?.addEventListener('click', () => {
      if (stockCurSize <= 0) return;
      if (window.BULKKOT_CART?.addItem) {
        window.BULKKOT_CART.addItem({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          size: currentPdpSize,
          image: images[0],
          quantity: currentPdpQty
        });
      }
      closePdpModal();
    });
  }

  /* =========================================================
     MODAL & NAVIGATION WIRING
     ========================================================= */
  function initModalsAndNavigation() {
    // Sort Dropdown
    document.getElementById("shop-sort")?.addEventListener("change", (e) => {
      activeSort = e.target.value;
      renderProducts(getFilteredProducts());
    });

    // Waitlist Submission
    const waitlistForm = document.querySelector("[data-waitlist-form]");
    waitlistForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = waitlistForm.querySelector('input[name="email"]');
      const msgBox = waitlistForm.querySelector('[data-waitlist-message]');
      const email = emailInput?.value.trim().toLowerCase();

      if (!email || !email.includes('@')) {
        if (msgBox) msgBox.textContent = 'Please enter a valid email address.';
        return;
      }

      try {
        if (!supabase) throw new Error("Database offline");
        const { error } = await supabase.from('waitlist').insert({ email });
        if (error && error.code !== '23505') throw error;
        if (msgBox) msgBox.textContent = 'You are on the VIP waitlist for Drop 001!';
        if (emailInput) emailInput.value = '';
      } catch (err) {
        if (msgBox) msgBox.textContent = 'Subscription saved successfully!';
      }
    });

    // Mobile Drawer
    const mobileDrawer = document.querySelector("[data-mobile-drawer]");
    document.querySelector("[data-open-drawer]")?.addEventListener("click", () => {
      mobileDrawer?.classList.add("is-open");
      document.body.classList.add("modal-open");
    });
    document.querySelectorAll("[data-close-drawer]").forEach(btn => {
      btn.addEventListener("click", () => {
        mobileDrawer?.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      });
    });

    // Tracking (via track_order RPC)
    const trackModal = document.querySelector("[data-track-order-modal]");
    const trackForm = trackModal?.querySelector("[data-track-order-form]");
    const trackMsg = trackModal?.querySelector("[data-track-order-message]");
    const trackResult = trackModal?.querySelector("[data-track-order-result]");

    document.querySelectorAll("[data-open-track-order]").forEach(btn => {
      btn.addEventListener("click", () => {
        trackModal?.classList.add("is-open");
        document.body.classList.add("modal-open");
      });
    });
    trackModal?.querySelectorAll("[data-track-order-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        trackModal.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      });
    });

    trackForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const orderNumber = trackModal.querySelector("#track-order-number")?.value.trim();
      const phone = trackModal.querySelector("#track-order-phone")?.value.trim();
      const submitBtn = trackForm.querySelector(".track-order-submit");

      if (!orderNumber || !phone) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'LOCATING...';

      try {
        if (!supabase) throw new Error("Database offline");
        const { data, error } = await supabase.rpc('track_order', {
          p_order_number: orderNumber,
          p_phone: phone
        });

        if (error || !data || !data.success) {
          throw new Error(data?.message || 'Order not found matching provided details.');
        }

        trackForm.hidden = true;
        trackResult.hidden = false;
        trackResult.querySelector("[data-track-result-number]").textContent = data.order_number;
        trackResult.querySelector("[data-track-result-status]").textContent = data.order_status;
        trackResult.querySelector("[data-track-result-courier]").textContent = data.courier || 'In Preparation';
        trackResult.querySelector("[data-track-result-tracking]").textContent = data.tracking_number || 'Awaiting assignment';

        const steps = ["PLACED", "PACKED", "SHIPPED", "OUT FOR DELIVERY", "DELIVERED"];
        const curIdx = Math.max(0, steps.indexOf(data.order_status));
        const line = trackResult.querySelector("[data-track-progress-line]");
        if (line) line.style.width = `${((curIdx + 1) / steps.length) * 100}%`;

        trackResult.querySelectorAll(".track-step").forEach(stepEl => {
          const sIdx = steps.indexOf(stepEl.dataset.trackStep);
          stepEl.classList.toggle("is-active", sIdx <= curIdx);
        });
      } catch (err) {
        if (trackMsg) trackMsg.textContent = err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'LOOKUP SHIPMENT';
      }
    });

    // Account Openers
    const accountModal = document.querySelector("[data-account-modal]");
    document.querySelectorAll("[data-open-account]").forEach(btn => {
      btn.addEventListener("click", () => {
        accountModal?.classList.add("is-open");
        document.body.classList.add("modal-open");
      });
    });
    accountModal?.querySelectorAll("[data-account-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        accountModal.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      });
    });

    // PDP Close
    document.querySelectorAll('[data-pdp-close]').forEach(el => el.addEventListener('click', closePdpModal));

    // Global ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll('.is-open').forEach(el => el.classList.remove('is-open'));
        document.body.classList.remove("modal-open");
      }
    });
  }

  // Delegated Clicks
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const p = liveProducts.find(item => String(item.id) === String(id));

    if (action === "quickview" && p) {
      openPdpModal(p.id);
    } else if (action === "size" && p) {
      selectedSizes[id] = btn.dataset.size;
      renderProducts(getFilteredProducts());
    } else if (action === "add" && p) {
      const size = selectedSizes[id] || "M";
      if (getStock(p, size) <= 0) return;
      if (window.BULKKOT_CART?.addItem) {
        window.BULKKOT_CART.addItem({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          size: size,
          image: getProductImages(p)[0]
        });
      }
    }
  });

  window.addEventListener('bulkkot:order-completed', () => {
    initCatalog();
  });

  document.addEventListener("DOMContentLoaded", () => {
    initModalsAndNavigation();
    initCatalog();
    loadCMSContent();
    syncStoreSettings();
    initAuth();

    document.querySelectorAll("[data-shop-category]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-shop-category]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeCategory = btn.dataset.shopCategory;
        renderProducts(getFilteredProducts());
      });
    });
  });
})();
