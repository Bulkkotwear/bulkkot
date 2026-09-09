/**
 * BULKKOT — Production Main Storefront Engine
 * Version: 12.0 (Unified Core, Bug-Free Navigation, Premium Auth & Search)
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  const supabase = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  window.bulkkotSupabase = supabase;

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
     FIRST-VISIT WELCOME POP-UP
     ========================================================= */
  function initWelcomePopup() {
    const popup = document.getElementById('welcomePopupModal');
    const closeBtn = document.getElementById('welcomePopupClose');
    const googleBtn = document.getElementById('welcomeGoogleBtn');
    const emailBtn = document.getElementById('welcomeEmailBtn');

    if (!popup) return;

    const hasSeen = localStorage.getItem('bulkkot_welcome_seen');
    if (!hasSeen) {
      setTimeout(() => {
        popup.classList.add('is-open');
        popup.setAttribute('aria-hidden', 'false');
      }, 1500);
    }

    function dismissPopup() {
      popup.classList.remove('is-open');
      popup.setAttribute('aria-hidden', 'true');
      localStorage.setItem('bulkkot_welcome_seen', 'true');
    }

    closeBtn?.addEventListener('click', dismissPopup);
    popup.addEventListener('click', (e) => {
      if (e.target === popup) dismissPopup();
    });

    googleBtn?.addEventListener('click', async () => {
      dismissPopup();
      if (!supabase) return;
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    });

    emailBtn?.addEventListener('click', () => {
      dismissPopup();
      const accountModal = document.querySelector('[data-account-modal]');
      accountModal?.classList.add('is-open');
      document.body.classList.add('modal-open');
    });
  }

  /* =========================================================
     INLINE EXPANDABLE HEADER SEARCH
     ========================================================= */
  function initInlineSearch() {
    const toggleBtns = document.querySelectorAll('#headerSearchToggle, [data-open-search]');
    const searchBar = document.getElementById('headerSearchBar');
    const closeBtn = document.getElementById('headerSearchClose');
    const input = document.getElementById('liveSearchInput');

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        searchBar?.classList.toggle('is-active');
        if (searchBar?.classList.contains('is-active')) {
          setTimeout(() => input?.focus(), 60);
        }
      });
    });

    closeBtn?.addEventListener('click', () => {
      searchBar?.classList.remove('is-active');
      activeSearch = "";
      if (input) input.value = "";
      renderProducts(getFilteredProducts());
    });

    input?.addEventListener('input', (e) => {
      activeSearch = e.target.value.trim().toLowerCase();
      renderProducts(getFilteredProducts());
    });

    document.querySelectorAll('[data-search-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.searchTag.toLowerCase();
        if (input) input.value = tag;
        activeSearch = tag;
        renderProducts(getFilteredProducts());
        document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  /* =========================================================
     PREMIUM MYNTRA-STYLE AUTH & ACCOUNT MODAL
     ========================================================= */
  async function initAuth() {
    if (!supabase) return;

    async function updateAuthUI() {
      const { data: { user } } = await supabase.auth.getUser();
      const accountLabel = document.querySelector('[data-account-label]');
      const authView = document.querySelector('[data-account-auth]');
      const userView = document.querySelector('[data-account-user]');
      const userEmailEl = document.querySelector('[data-account-user-email]');

      if (user) {
        const displayName = (user.user_metadata?.full_name || user.email.split('@')[0]).toUpperCase();
        if (accountLabel) accountLabel.textContent = displayName;
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
      updateAuthUI();
      if (window.BULKKOT_CART?.renderCart) window.BULKKOT_CART.renderCart();
    });

    updateAuthUI();

    const loginForm = document.querySelector('[data-account-login-form]');
    const msgEl = document.getElementById('authInlineError');
    const signupToggle = document.querySelector('[data-account-signup-toggle]');
    const modeText = document.getElementById('auth-mode-text');
    const nameField = document.getElementById('account-name-field');
    const nameInput = document.getElementById('account-name-input');

    // Smooth Toggle between Login & Signup
    signupToggle?.addEventListener('click', () => {
      const isSignUp = loginForm.dataset.mode === 'signup';
      const submitBtn = loginForm.querySelector('.account-submit');
      if (msgEl) msgEl.textContent = '';

      if (isSignUp) {
        loginForm.dataset.mode = 'signin';
        if(nameField) nameField.style.display = 'none';
        if(nameInput) nameInput.removeAttribute('required');
        if(modeText) modeText.innerHTML = 'Login <span style="font-weight:400; font-size:18px;">or</span> Signup';
        if(submitBtn) submitBtn.textContent = 'CONTINUE';
        signupToggle.innerHTML = 'New to BULKKOT? <strong>Create an account</strong>';
      } else {
        loginForm.dataset.mode = 'signup';
        if(nameField) nameField.style.display = 'flex';
        if(nameInput) nameInput.setAttribute('required', 'true');
        if(modeText) modeText.innerHTML = 'Create Account';
        if(submitBtn) submitBtn.textContent = 'CREATE ACCOUNT';
        signupToggle.innerHTML = 'Already have an account? <strong>Login here</strong>';
      }
    });

    // Form Submit Logic
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('#account-email')?.value.trim();
      const password = loginForm.querySelector('#account-password')?.value;
      const fullName = nameInput?.value.trim();
      const submitBtn = loginForm.querySelector('.account-submit');
      const isSignUp = loginForm.dataset.mode === 'signup';

      if (!email || !password || (isSignUp && !fullName)) {
        if (msgEl) msgEl.textContent = 'Please fill in all required fields.';
        return;
      }

      if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'PROCESSING...';
      }
      if (msgEl) msgEl.textContent = '';

      try {
        if (isSignUp) {
          const { data, error } = await supabase.auth.signUp({
            email, 
            password,
            options: { data: { full_name: fullName } }
          });
          if (error) throw error;
          
          if (data?.user) {
            await supabase.from('customer_profiles').upsert({
              id: data.user.id,
              full_name: fullName,
              updated_at: new Date().toISOString()
            });
          }
          if (msgEl) {
            msgEl.style.color = '#31c48d';
            msgEl.textContent = 'Account created successfully!';
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
      } catch (err) {
        if (msgEl) {
          msgEl.style.color = '#ff7777';
          msgEl.textContent = err.message || 'Authentication failed.';
        }
      } finally {
        if(submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = isSignUp ? 'CREATE ACCOUNT' : 'CONTINUE';
        }
      }
    });

    // Google OAuth
    document.querySelector('[data-google-login]')?.addEventListener('click', async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    });

    // Sign Out
    const signoutBtn = document.querySelector('[data-account-signout]');
    signoutBtn?.addEventListener('click', async () => {
      signoutBtn.textContent = 'SIGNING OUT...';
      await supabase.auth.signOut();
      signoutBtn.textContent = 'SIGN OUT';
    });

    // Profile Details Update
    const profileForm = document.querySelector('[data-account-profile-form]');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profileData = {
        id: user.id,
        full_name: profileForm.querySelector('#account-name')?.value.trim(),
        phone: profileForm.querySelector('#account-phone')?.value.trim(),
        shipping_address: profileForm.querySelector('#account-address')?.value.trim(),
        shipping_city: profileForm.querySelector('#account-city')?.value.trim(),
        shipping_state: profileForm.querySelector('#account-state')?.value.trim(),
        shipping_pincode: profileForm.querySelector('#account-pincode')?.value.trim(),
        updated_at: new Date().toISOString()
      };

      const profMsg = document.querySelector('[data-profile-message]');
      const btn = profileForm.querySelector('button');
      if(btn) { btn.disabled = true; btn.textContent = 'SAVING...'; }

      try {
        const { error } = await supabase.from('customer_profiles').upsert(profileData);
        if (error) throw error;
        if (profMsg) profMsg.textContent = 'Profile saved successfully!';
        setTimeout(() => { if (profMsg) profMsg.textContent = ''; }, 3000);
      } catch (err) {
        if (profMsg) profMsg.textContent = err.message || 'Failed to save.';
      } finally {
        if(btn) { btn.disabled = false; btn.textContent = 'SAVE PROFILE'; }
      }
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

      const email = data.support_email;
      if (email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => a.href = `mailto:${email}`);
        document.querySelectorAll('[data-cms-key="contact_email"]').forEach(el => el.textContent = email);
      }
    } catch (e) {}
  }

  /* =========================================================
     READ-ONLY CMS LOADER
     ========================================================= */
  async function loadCMSContent() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from("site_content").select("content_key, content_value, image_url, content_type");
      if (error || !data) return;

      data.forEach(row => {
        const key = row.content_key;
        const val = row.content_value || row.image_url || "";
        const type = row.content_type || "text";
        document.querySelectorAll(`[data-cms-key="${CSS.escape(key)}"]`).forEach(el => {
          if (type === "image" || el.tagName === "IMG") el.src = val;
          else el.textContent = val;
        });
      });
    } catch (e) {}
  }

  /* =========================================================
     CATALOGUE & PRODUCTS
     ========================================================= */
  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid || !supabase) return;

    try {
      const { data, error } = await supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
      if (error) throw error;
      liveProducts = data || [];
      liveProducts.forEach(p => selectedSizes[p.id] = ["S", "M", "L", "XL"].find(s => getStock(p, s) > 0) || "M");
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
      grid.innerHTML = '<p class="catalog-message" style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">No garments found matching your filter.</p>';
      return;
    }

    grid.innerHTML = items.map(p => {
      const cat = getCategory(p);
      const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
      const totalStock = getTotalStock(p);
      const curSize = selectedSizes[p.id] || "M";
      const badge = getStockBadge(p, curSize);
      const images = getProductImages(p);
      const coverImage = images[0];

      const sizePills = ["S", "M", "L", "XL"].map(s => {
        const qty = getStock(p, s);
        const sel = curSize === s;
        return `<button type="button" class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}" data-action="size" data-id="${p.id}" data-size="${s}">${s}</button>`;
      }).join('');

      return `
        <article class="product-card" data-product-card data-category="${cat}">
          <div class="product-card__thumb" data-action="quickview" data-id="${p.id}" style="cursor: pointer;">
            <img src="${escapeHTML(coverImage)}" alt="${escapeHTML(p.name)}" loading="lazy">
            <span class="product-status">${totalStock <= 0 ? 'SOLD OUT' : 'DROP 001'}</span>
          </div>
          <div class="product-information">
            <div class="product-information__header" data-action="quickview" data-id="${p.id}" style="cursor: pointer;">
              <div><h3>${escapeHTML(p.name)}</h3><p class="product-category">${catKorean}</p></div>
              <span class="product-price">${formatPrice(p.price)}</span>
            </div>
            <div class="product-sizes-row"><div class="product-sizes">${sizePills}</div><span class="product-stock ${badge.cls}">${badge.text}</span></div>
            <button type="button" class="button button--primary product-add-button" data-action="add" data-id="${p.id}" ${badge.disabled ? 'disabled' : ''}>
              ${badge.disabled ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  /* =========================================================
     PRODUCT DETAIL MODAL (PDP) & RELATED PRODUCTS
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
    modal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closePdpModal() {
    const modal = document.getElementById('pdpModal');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
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
      const rest = liveProducts.filter(item => String(item.id) !== String(p.id) && getCategory(item) !== cat);
      related = [...related, ...rest].slice(0, 4);
    } else related = related.slice(0, 4);

    const thumbsHtml = images.map((img, i) => `
      <div class="pdp-thumb ${i === 0 ? 'is-active' : ''}" data-pdp-thumb="${i}">
        <img src="${escapeHTML(img)}" alt="Thumbnail ${i + 1}">
      </div>
    `).join('');

    const sizeButtons = ["S", "M", "L", "XL"].map(s => {
      const st = getStock(p, s);
      const isSelected = currentPdpSize === s;
      const isOut = st <= 0;
      return `<button type="button" class="pdp-size-btn ${isSelected ? 'is-selected' : ''} ${isOut ? 'is-sold-out' : ''}" data-pdp-size="${s}" ${isOut ? 'disabled' : ''}>${s}</button>`;
    }).join('');

    const relatedHtml = related.map(rel => {
      const rImages = getProductImages(rel);
      return `
        <div class="pdp-related-card" data-action="quickview" data-id="${rel.id}">
          <img src="${escapeHTML(rImages[0])}" alt="${escapeHTML(rel.name)}">
          <div class="pdp-related-meta"><strong>${escapeHTML(rel.name)}</strong><span>${formatPrice(rel.price)}</span></div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="pdp-grid">
        <div class="pdp-gallery">
          <div class="pdp-main-image-wrap"><img src="${escapeHTML(images[0])}" id="pdpMainImage" class="pdp-main-image" alt="${escapeHTML(p.name)}"></div>
          ${images.length > 1 ? `<div class="pdp-thumbnails">${thumbsHtml}</div>` : ''}
        </div>
        <div class="pdp-info">
          <span class="pdp-korean">${catKorean} · DROP 001</span>
          <h2 class="pdp-title">${escapeHTML(p.name)}</h2>
          <div class="pdp-price">${formatPrice(p.price)}</div>
          <p class="pdp-desc">${escapeHTML(p.description || 'Constructed from heavyweight luxury combed cotton. Tailored with architectural restraint for an elevated, relaxed drape.')}</p>
          <div class="pdp-option-title"><span>SELECT SIZE</span><span style="color: ${stockCurSize <= 2 && stockCurSize > 0 ? 'var(--bk-yellow, #f5c542)' : '#777'};">${stockCurSize <= 0 ? 'SOLD OUT' : (stockCurSize <= 4 ? `ONLY ${stockCurSize} LEFT` : 'IN STOCK')}</span></div>
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
      ${related.length > 0 ? `<div class="pdp-related"><div class="pdp-related-title">SIMILAR SILHOUETTES</div><div class="pdp-related-grid">${relatedHtml}</div></div>` : ''}
    `;

    container.querySelectorAll('[data-pdp-thumb]').forEach(tb => {
      tb.addEventListener('click', () => {
        container.querySelectorAll('[data-pdp-thumb]').forEach(t => t.classList.remove('is-active'));
        tb.classList.add('is-active');
        const mainImg = document.getElementById('pdpMainImage');
        if (mainImg && images[tb.dataset.pdpThumb]) mainImg.src = images[tb.dataset.pdpThumb];
      });
    });

    container.querySelectorAll('[data-pdp-size]').forEach(sb => {
      sb.addEventListener('click', () => { currentPdpSize = sb.dataset.pdpSize; renderPdpView(); });
    });

    container.querySelector('#pdpQtyMinus')?.addEventListener('click', () => {
      if (currentPdpQty > 1) { currentPdpQty--; container.querySelector('#pdpQtyVal').textContent = currentPdpQty; }
    });
    container.querySelector('#pdpQtyPlus')?.addEventListener('click', () => {
      if (currentPdpQty < stockCurSize) { currentPdpQty++; container.querySelector('#pdpQtyVal').textContent = currentPdpQty; }
    });

    container.querySelector('#pdpAddBtn')?.addEventListener('click', () => {
      if (stockCurSize <= 0) return;
      if (window.BULKKOT_CART?.addItem) {
        window.BULKKOT_CART.addItem({ id: p.id, name: p.name, price: Number(p.price || 0), size: currentPdpSize, image: images[0], quantity: currentPdpQty });
      }
      closePdpModal();
    });
  }

  /* =========================================================
     UNIVERSAL MODAL & NAVIGATION BINDINGS
     ========================================================= */
  function initModalsAndNavigation() {
    // Mobile Drawer
    const mobileDrawer = document.querySelector("[data-mobile-drawer]");
    document.querySelectorAll("[data-open-drawer]").forEach(btn => btn.addEventListener("click", () => {
      mobileDrawer?.classList.add("is-open");
      document.body.classList.add("modal-open");
    }));
    document.querySelectorAll("[data-close-drawer]").forEach(btn => btn.addEventListener("click", () => {
      mobileDrawer?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    }));

    // Policy & About Modals
    document.querySelectorAll("[data-open-policy]").forEach(btn => btn.addEventListener("click", (e) => { e.preventDefault(); document.querySelector("[data-policy-modal]")?.classList.add("is-open"); }));
    document.querySelectorAll("[data-close-policy]").forEach(btn => btn.addEventListener("click", () => document.querySelector("[data-policy-modal]")?.classList.remove("is-open")));
    
    document.querySelectorAll("[data-open-about]").forEach(btn => btn.addEventListener("click", () => document.querySelector("[data-about-modal]")?.classList.add("is-open")));
    document.querySelectorAll("[data-close-about]").forEach(btn => btn.addEventListener("click", () => document.querySelector("[data-about-modal]")?.classList.remove("is-open")));

    document.querySelectorAll("[data-size-guide-open]").forEach(btn => btn.addEventListener("click", () => document.querySelector("[data-size-guide-modal]")?.classList.add("is-open")));
    document.querySelectorAll("[data-size-guide-close]").forEach(btn => btn.addEventListener("click", () => document.querySelector("[data-size-guide-modal]")?.classList.remove("is-open")));

    // Account Modal
    const accountModal = document.querySelector("[data-account-modal]");
    document.querySelectorAll("[data-open-account]").forEach(btn => btn.addEventListener("click", () => {
      accountModal?.classList.add("is-open");
      document.body.classList.add("modal-open");
    }));
    document.querySelectorAll("[data-account-close]").forEach(btn => btn.addEventListener("click", () => {
      accountModal?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    }));

    // 100% Working Track Order Modal
    const trackModal = document.querySelector("[data-track-order-modal]");
    const trackForm = trackModal?.querySelector("[data-track-order-form]");
    const trackMsg = trackModal?.querySelector("[data-track-order-message]");
    const trackResult = trackModal?.querySelector("[data-track-order-result]");

    document.querySelectorAll("[data-open-track-order], [data-open-track]").forEach(btn => btn.addEventListener("click", () => {
      trackModal?.classList.add("is-open");
      document.body.classList.add("modal-open");
    }));
    document.querySelectorAll("[data-track-order-close], [data-close-track]").forEach(btn => btn.addEventListener("click", () => {
      trackModal?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    }));

    trackModal?.querySelector("[data-track-again]")?.addEventListener("click", () => {
      if(trackResult) trackResult.hidden = true;
      if(trackForm) trackForm.hidden = false;
      if (trackMsg) trackMsg.textContent = "";
    });

    trackForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const orderNumber = trackModal.querySelector("#track-order-number")?.value.trim().toUpperCase();
      const rawInputPhone = trackModal.querySelector("#track-order-phone")?.value.trim().replace(/\D/g, '');
      if (!orderNumber || !rawInputPhone) {
        if (trackMsg) trackMsg.textContent = "Please provide both Order Number and Phone Number.";
        return;
      }

      const submitBtn = trackForm.querySelector(".track-order-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "LOCATING...";
      if (trackMsg) trackMsg.textContent = "";

      try {
        if (!supabase) throw new Error("Database offline.");
        const { data, error } = await supabase.rpc("lookup_guest_order", { p_order_number: orderNumber, p_phone: rawInputPhone });
        if (error || !data) throw new Error("No shipment found.");
        
        trackForm.hidden = true;
        trackResult.hidden = false;
        trackResult.querySelector("[data-track-result-number]").textContent = data.order_number;
        trackResult.querySelector("[data-track-result-status]").textContent = data.status || "PLACED";
        trackResult.querySelector("[data-track-result-courier]").textContent = data.courier_partner || "Preparing";
        trackResult.querySelector("[data-track-result-tracking]").textContent = data.awb_number || "Will update upon pickup";

        const steps = ["PLACED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
        const currentStatus = String(data.status || 'PLACED').toUpperCase().replace(/ /g, '_');
        const curIdx = steps.indexOf(currentStatus) >= 0 ? steps.indexOf(currentStatus) : 0;
        
        trackResult.querySelectorAll(".track-step").forEach((stepEl, idx) => {
          stepEl.classList.toggle("is-active", idx <= curIdx);
          stepEl.classList.toggle("is-current", idx === curIdx);
        });

      } catch (err) {
        if (trackMsg) trackMsg.textContent = err.message || "Failed to find order.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "LOOKUP SHIPMENT";
      }
    });

    // Global Dismiss on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelector("[data-policy-modal]")?.classList.remove("is-open");
        document.querySelector("[data-about-modal]")?.classList.remove("is-open");
        document.querySelector("[data-size-guide-modal]")?.classList.remove("is-open");
        accountModal?.classList.remove("is-open");
        trackModal?.classList.remove("is-open");
        closePdpModal();
        document.getElementById('headerSearchBar')?.classList.remove('is-active');
        document.getElementById('welcomePopupModal')?.classList.remove('is-open');
        if (window.BULKKOT_CART?.closeCart) window.BULKKOT_CART.closeCart();
        mobileDrawer?.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      }
    });
  }

  // Delegated Clicks (Quick View, Size & Add to Bag)
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
      const images = getProductImages(p);
      if (window.BULKKOT_CART && typeof window.BULKKOT_CART.addItem === "function") {
        window.BULKKOT_CART.addItem({ id: p.id, name: p.name, price: Number(p.price || 0), size: size, image: images[0] });
      }
    }
  });

  window.addEventListener('bulkkot:order-completed', () => { initCatalog(); });

  function initStorefront() {
    initModalsAndNavigation();
    initCatalog();
    loadCMSContent();
    syncStoreSettings();
    initAuth();
    initInlineSearch();
    initWelcomePopup();

    document.querySelectorAll("[data-shop-category]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-shop-category]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeCategory = btn.dataset.shopCategory;
        renderProducts(getFilteredProducts());
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initStorefront);
  } else {
    initStorefront();
  }
})();
