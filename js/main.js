/**
 * BULKKOT — Production Main Storefront Engine
 * Version: 13.0 (Zero Visual Alteration — Full Internal Functionality)
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
  let editorialTimer = null;

  /* =========================================================
     BODY SCROLL LOCK RECOVERY
     ========================================================= */
  let bodyLockCount = 0;

  function hasBlockingOverlay() {
    return Boolean(document.querySelector(
      '[data-mobile-drawer].is-open, #mobileDrawer.is-open, [data-policy-modal].is-open, [data-about-modal].is-open, [data-size-guide-modal].is-open, [data-track-order-modal].is-open, [data-account-modal].is-open, [data-pdp-modal].is-open, #pdpModal.is-open, [data-cart-drawer].is-open, #cart-drawer.is-open'
    ));
  }

  function lockBodyScroll() {
    bodyLockCount += 1;
    document.body.classList.add("modal-open");
  }

  function unlockBodyScroll() {
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (!hasBlockingOverlay()) {
      bodyLockCount = 0;
      document.body.classList.remove("modal-open", "drawer-open");
    }
  }

  function forceUnlockBodyScroll() {
    bodyLockCount = 0;
    document.body.classList.remove("modal-open", "drawer-open");
  }

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
      lockBodyScroll();
    });
  }

  /* =========================================================
     INLINE EXPANDABLE HEADER SEARCH WITH REDIRECT
     ========================================================= */
  function initInlineSearch() {
    const toggleBtn = document.getElementById('headerSearchToggle');
    const searchBar = document.getElementById('headerSearchBar');
    const closeBtn = document.getElementById('headerSearchClose');
    const input = document.getElementById('liveSearchInput');
    const form = document.getElementById('headerSearchForm') || document.getElementById('searchRedirectForm');

    function openSearch() {
      searchBar?.classList.add('is-active');
      setTimeout(() => input?.focus(), 60);
    }

    function closeSearch() {
      searchBar?.classList.remove('is-active');
      activeSearch = "";
      if (input) input.value = "";
      renderProducts(getFilteredProducts());
    }

    toggleBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      searchBar?.classList.contains('is-active') ? closeSearch() : openSearch();
    });

    closeBtn?.addEventListener('click', closeSearch);

    function handleSearchRedirect(q) {
      const query = String(q || "").trim();
      if (!query) return;
      const isShop = /(^|\/)shop\.html$/i.test(window.location.pathname);
      if (!isShop) {
        window.location.href = `shop.html?q=${encodeURIComponent(query)}`;
      } else {
        activeSearch = query.toLowerCase();
        renderProducts(getFilteredProducts());
      }
    }

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSearchRedirect(input?.value);
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchRedirect(input.value);
      }
    });

    input?.addEventListener('input', (e) => {
      activeSearch = e.target.value.trim().toLowerCase();
      renderProducts(getFilteredProducts());
    });

    document.querySelectorAll('[data-search-tag], [data-search-term]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = (btn.dataset.searchTag || btn.dataset.searchTerm || btn.textContent).trim();
        if (input) input.value = tag;
        handleSearchRedirect(tag);
      });
    });
  }

  /* =========================================================
     EDITORIAL CAROUSEL ENGINE
     ========================================================= */
  function initEditorialCarousel() {
    const container = document.getElementById('editorialCarousel');
    if (!container) return;

    const slides = Array.from(container.querySelectorAll('.editorial-slide'));
    const dots = Array.from(container.querySelectorAll('[data-slide-indicator], .carousel-indicator'));
    const prev = container.querySelector('[data-carousel-prev], .carousel-control--prev, #editorialPrev');
    const next = container.querySelector('[data-carousel-next], .carousel-control--next, #editorialNext');

    if (!slides.length) return;
    let currentIdx = 0;

    function showSlide(index) {
      currentIdx = (index + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === currentIdx));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === currentIdx));
    }

    function stopTimer() {
      if (editorialTimer) {
        clearInterval(editorialTimer);
        editorialTimer = null;
      }
    }

    function startTimer() {
      stopTimer();
      editorialTimer = setInterval(() => showSlide(currentIdx + 1), 6000);
    }

    prev?.addEventListener('click', () => { showSlide(currentIdx - 1); startTimer(); });
    next?.addEventListener('click', () => { showSlide(currentIdx + 1); startTimer(); });
    dots.forEach((dot, idx) => dot.addEventListener('click', () => { showSlide(idx); startTimer(); }));

    container.addEventListener('mouseenter', stopTimer);
    container.addEventListener('mouseleave', startTimer);

    showSlide(0);
    startTimer();
  }

  /* =========================================================
     AUTH & ACCOUNT MODAL (SIGN IN / SIGN UP / PROFILE)
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

    signupToggle?.addEventListener('click', () => {
      const isSignUp = loginForm.dataset.mode === 'signup';
      const submitBtn = loginForm.querySelector('.account-submit');
      if (msgEl) msgEl.textContent = '';

      if (isSignUp) {
        loginForm.dataset.mode = 'signin';
        if (nameField) nameField.style.display = 'none';
        nameInput?.removeAttribute('required');
        if (modeText) modeText.innerHTML = 'Login <span style="font-weight:400; font-size:18px;">or</span> Signup';
        if (submitBtn) submitBtn.textContent = 'CONTINUE';
        signupToggle.innerHTML = 'New to BULKKOT? <strong>Create an account</strong>';
      } else {
        loginForm.dataset.mode = 'signup';
        if (nameField) nameField.style.display = 'flex';
        nameInput?.setAttribute('required', 'true');
        if (modeText) modeText.innerHTML = 'Create Account';
        if (submitBtn) submitBtn.textContent = 'CREATE ACCOUNT';
        signupToggle.innerHTML = 'Already have an account? <strong>Login here</strong>';
      }
    });

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

      submitBtn.disabled = true;
      submitBtn.textContent = 'PROCESSING...';
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
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;
        }
      } catch (err) {
        if (msgEl) {
          msgEl.style.color = '#ff7777';
          msgEl.textContent = err.message || 'Authentication failed.';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUp ? 'CREATE ACCOUNT' : 'CONTINUE';
      }
    });

    document.querySelector('[data-google-login]')?.addEventListener('click', async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    });

    const signoutBtn = document.querySelector('[data-account-signout]');
    signoutBtn?.addEventListener('click', async () => {
      signoutBtn.textContent = 'SIGNING OUT...';
      await supabase.auth.signOut();
      signoutBtn.textContent = 'SIGN OUT';
    });

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
      btn.disabled = true;
      btn.textContent = 'SAVING...';

      try {
        const { error } = await supabase.from('customer_profiles').upsert(profileData);
        if (error) throw error;
        if (profMsg) profMsg.textContent = 'Profile saved successfully!';
        setTimeout(() => {
          if (profMsg) profMsg.textContent = '';
        }, 3000);
      } catch (err) {
        if (profMsg) profMsg.textContent = err.message || 'Failed to save.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'SAVE PROFILE';
      }
    });
  }

  async function loadCustomerProfile(userId) {
    if (!supabase) return;

    try {
      const { data } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

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
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

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
      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (!data) return;

      const rawPhone = String(data.support_phone || '').replace(/\D/g, '');
      const whatsappBtn = document.querySelector('.whatsapp-float');

      if (whatsappBtn && rawPhone) {
        whatsappBtn.href = `https://wa.me/${rawPhone}?text=${encodeURIComponent('Hi BULKKOT, I have an inquiry about Drop 001.')}`;
      }

      const email = data.support_email;
      if (email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => a.href = `mailto:${email}`);
      }
    } catch (e) {}
  }

  /* =========================================================
     CATALOGUE & PRODUCTS (EMPTY STATE GRACEFUL HANDLING)
     ========================================================= */
  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!supabase) {
      grid.innerHTML = '<p class="catalog-message">Drop 001 collection releasing shortly.</p>';
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      liveProducts = Array.isArray(data) ? data : [];

      if (!liveProducts.length) {
        grid.innerHTML = '<p class="catalog-message" style="grid-column:1/-1;">Drop 001 collection releasing shortly.</p>';
        return;
      }

      liveProducts.forEach(p => {
        selectedSizes[p.id] = ["S", "M", "L", "XL"].find(s => getStock(p, s) > 0) || "M";
      });

      renderProducts(getFilteredProducts());
    } catch (err) {
      grid.innerHTML = '<p class="catalog-message" style="grid-column:1/-1;">Drop 001 collection releasing shortly.</p>';
    }
  }

  function getFilteredProducts() {
    let list = [...liveProducts];
    if (activeCategory !== "all") {
      list = list.filter(p => getCategory(p) === activeCategory.toLowerCase());
    }
    if (activeSearch) {
      list = list.filter(p => (p.name || "").toLowerCase().includes(activeSearch));
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
      grid.innerHTML = '<p class="catalog-message" style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">No garments found matching your filter.</p>';
      return;
    }

    grid.innerHTML = items.map(p => {
      const cat = getCategory(p);
      const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
      const totalStock = getTotalStock(p);
      const curSize = selectedSizes[p.id] || "M";
      const badge = getStockBadge(p, curSize);
      const coverImage = getProductImages(p)[0];

      const sizePills = ["S", "M", "L", "XL"].map(s => {
        const qty = getStock(p, s);
        const sel = curSize === s;
        return `
          <button type="button" class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}" data-action="size" data-id="${p.id}" data-size="${s}">
            ${s}
          </button>
        `;
      }).join('');

      return `
        <article class="product-card" data-product-card data-category="${cat}">
          <div class="product-card__thumb" data-action="quickview" data-id="${p.id}" style="cursor: pointer;">
            <img src="${escapeHTML(coverImage)}" alt="${escapeHTML(p.name)}" loading="lazy">
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
    modal?.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
  }

  function closePdpModal() {
    const modal = document.getElementById('pdpModal');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
  }

  function renderPdpView() {
    const container = document.getElementById('pdpContent');
    const p = currentPdpProduct;
    if (!container || !p) return;

    const images = getProductImages(p);
    const cat = getCategory(p);
    const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
    const stockCurSize = getStock(p, currentPdpSize);

    const sizeButtons = ["S", "M", "L", "XL"].map(s => {
      const st = getStock(p, s);
      const isSelected = currentPdpSize === s;
      const isOut = st <= 0;
      return `
        <button type="button" class="pdp-size-btn ${isSelected ? 'is-selected' : ''} ${isOut ? 'is-sold-out' : ''}" data-pdp-size="${s}" ${isOut ? 'disabled' : ''}>
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
        </div>
        <div class="pdp-info">
          <span class="pdp-korean">${catKorean} · DROP 001</span>
          <h2 class="pdp-title">${escapeHTML(p.name)}</h2>
          <div class="pdp-price">${formatPrice(p.price)}</div>
          <p class="pdp-desc">${escapeHTML(p.description || 'Heavyweight luxury combed cotton. Engineered with architectural restraint.')}</p>
          <div class="pdp-option-title"><span>SELECT SIZE</span></div>
          <div class="pdp-sizes">${sizeButtons}</div>
          <div class="pdp-qty-row" style="margin-top:20px;">
            <button type="button" class="button button--primary pdp-add-btn" id="pdpAddBtn" ${stockCurSize <= 0 ? 'disabled' : ''}>
              ${stockCurSize <= 0 ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-pdp-size]').forEach(sb => {
      sb.addEventListener('click', () => {
        currentPdpSize = sb.dataset.pdpSize;
        renderPdpView();
      });
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
          quantity: 1
        });
      }
      closePdpModal();
    });
  }

  /* =========================================================
     UNIVERSAL MODAL & NAVIGATION
     ========================================================= */
  function initModalsAndNavigation() {
    const mobileDrawer = document.querySelector("[data-mobile-drawer]") || document.getElementById("mobileDrawer");
    const mobileOverlay = document.querySelector("[data-mobile-overlay]") || document.getElementById("mobileDrawerOverlay");
    const openDrawerBtn = document.querySelector("[data-open-drawer]") || document.getElementById("headerMenuToggle");
    const closeDrawerBtns = document.querySelectorAll("[data-close-drawer], #closeMobileDrawerBtn");

    function openMobileMenu() {
      mobileDrawer?.classList.add("is-open");
      mobileDrawer?.setAttribute("aria-hidden", "false");
      mobileOverlay?.classList.add("is-active", "is-visible");
      document.body.classList.add("drawer-open");
      lockBodyScroll();
    }

    function closeMobileMenu() {
      mobileDrawer?.classList.remove("is-open");
      mobileDrawer?.setAttribute("aria-hidden", "true");
      mobileOverlay?.classList.remove("is-active", "is-visible");
      document.body.classList.remove("drawer-open");
      unlockBodyScroll();
    }

    openDrawerBtn?.addEventListener("click", (e) => { e.preventDefault(); openMobileMenu(); });
    closeDrawerBtns.forEach(btn => btn.addEventListener("click", closeMobileMenu));
    mobileOverlay?.addEventListener("click", closeMobileMenu);
    document.querySelectorAll("[data-mobile-drawer] a, #mobileDrawer a").forEach(a => a.addEventListener("click", closeMobileMenu));

    /* Modals Mapping */
    const modalMap = [
      { trigger: "[data-open-about]", modal: "[data-about-modal]", close: "[data-close-about]" },
      { trigger: "[data-open-policy]", modal: "[data-policy-modal]", close: "[data-close-policy]" },
      { trigger: "[data-size-guide-open]", modal: "[data-size-guide-modal]", close: "[data-size-guide-close]" },
      { trigger: "[data-open-track-order]", modal: "[data-track-order-modal]", close: "[data-track-order-close]" },
      { trigger: "[data-open-account]", modal: "[data-account-modal]", close: "[data-account-close]" }
    ];

    modalMap.forEach(({ trigger, modal, close }) => {
      const m = document.querySelector(modal);
      document.querySelectorAll(trigger).forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          closeMobileMenu();
          if (btn.dataset.openPolicy && m) {
            const data = POLICY_DATA[btn.dataset.openPolicy] || { title: "INFORMATION", content: "<p>Information coming soon.</p>" };
            if (m.querySelector("[data-policy-title]")) m.querySelector("[data-policy-title]").textContent = data.title;
            if (m.querySelector("[data-policy-content]")) m.querySelector("[data-policy-content]").innerHTML = data.content;
          }
          m?.classList.add("is-open");
          m?.setAttribute("aria-hidden", "false");
          lockBodyScroll();
        });
      });

      m?.querySelectorAll(close).forEach(cb => {
        cb.addEventListener("click", (e) => {
          e.preventDefault();
          m.classList.remove("is-open");
          m.setAttribute("aria-hidden", "true");
          unlockBodyScroll();
        });
      });

      m?.addEventListener("click", (e) => {
        if (e.target === m || e.target.classList.contains("account-backdrop") || e.target.classList.contains("track-order-backdrop") || e.target.classList.contains("size-guide-backdrop")) {
          m.classList.remove("is-open");
          m.setAttribute("aria-hidden", "true");
          unlockBodyScroll();
        }
      });
    });

    /* Size guide switcher */
    const sizeTabs = document.querySelectorAll("[data-size-tab]");
    const sizePanels = document.querySelectorAll("[data-size-panel]");
    sizeTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        sizeTabs.forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        const target = tab.dataset.sizeTab;
        sizePanels.forEach(p => {
          const match = p.dataset.sizePanel === target;
          p.hidden = !match;
          p.classList.toggle("is-active", match);
        });
      });
    });

    /* Track Order Form Submit */
    const trackForm = document.querySelector("[data-track-order-form]");
    const trackMsg = document.querySelector("[data-track-order-message]");
    const trackResult = document.querySelector("[data-track-order-result]");
    const trackAgainBtn = document.querySelector("[data-track-again]");

    trackAgainBtn?.addEventListener("click", () => {
      if (trackResult) trackResult.hidden = true;
      if (trackForm) trackForm.hidden = false;
      if (trackMsg) trackMsg.textContent = "";
    });

    trackForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const orderNumber = document.querySelector("#track-order-number, #trackOrderNumberInput")?.value.trim().toUpperCase();
      const phone = document.querySelector("#track-order-phone, #trackOrderPhoneInput")?.value.trim().replace(/\D/g, "");

      if (!orderNumber || !phone) {
        if (trackMsg) trackMsg.textContent = "Please provide both Order Number and Phone.";
        return;
      }

      if (trackMsg) trackMsg.textContent = "LOCATING SHIPMENT...";

      try {
        if (!supabase) throw new Error("Offline. Try again later.");
        const { data, error } = await supabase.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
        if (error || !data) throw new Error("No shipment found matching that Order Number.");

        const dbPhone = String(data.customer_phone || "").replace(/\D/g, "");
        if (!dbPhone.endsWith(phone.slice(-10))) throw new Error("Phone number mismatch.");

        trackForm.hidden = true;
        trackResult.hidden = false;
        document.querySelector("[data-track-result-number]").textContent = data.order_number;
        document.querySelector("[data-track-result-status]").textContent = data.order_status || "PLACED";
        document.querySelector("[data-track-result-courier]").textContent = data.courier || "In Dispatch Preparation";
        document.querySelector("[data-track-result-tracking]").textContent = data.tracking_number || "Will update on dispatch";
        if (trackMsg) trackMsg.textContent = "";
      } catch (err) {
        if (trackMsg) trackMsg.textContent = err.message || "Failed to find order.";
      }
    });

    /* PDP Close */
    document.querySelectorAll('[data-pdp-close]').forEach(el => el.addEventListener('click', closePdpModal));

    /* Global Escape Key Handler */
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll('.is-open').forEach(el => {
          el.classList.remove('is-open');
          el.setAttribute('aria-hidden', 'true');
        });
        window.BULKKOT_CART?.closeCart();
        forceUnlockBodyScroll();
      }
    });
  }

  /* =========================================================
     GLOBAL DELEGATED ACTIONS
     ========================================================= */
  document.addEventListener("click", (e) => {
    /* PDP & Size selectors */
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      const p = liveProducts.find(item => String(item.id) === String(id));

      if (action === "quickview" && p) {
        openPdpModal(p.id);
      } else if (action === "size" && p) {
        selectedSizes[id] = actionBtn.dataset.size;
        renderProducts(getFilteredProducts());
      } else if (action === "add" && p) {
        const size = selectedSizes[id] || "M";
        if (getStock(p, size) <= 0) return;
        if (window.BULKKOT_CART?.addItem) {
          window.BULKKOT_CART.addItem({
            id: p.id,
            name: p.name,
            price: Number(p.price || 0),
            size,
            image: getProductImages(p)[0]
          });
        }
      }
    }

    /* Cart Open Triggers */
    if (e.target.closest("[data-open-cart], .cart-action")) {
      e.preventDefault();
      if (window.BULKKOT_CART?.openCart) {
        window.BULKKOT_CART.openCart();
      }
    }
  });

  /* =========================================================
     STORE FRONT BOOTSTRAP
     ========================================================= */
  function initStorefront() {
    initModalsAndNavigation();
    initCatalog();
    initEditorialCarousel();
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
