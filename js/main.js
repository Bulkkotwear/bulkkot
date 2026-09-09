/**
 * BULKKOT — Production Main Storefront Engine
 * Version: 8.0 (Multi-Image Array, Product Detail Modal & Related Products Engine)
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
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
          a.href = `mailto:${email}`;
        });
        document.querySelectorAll('[data-cms-key="contact_email"]').forEach(el => {
          el.textContent = email;
        });
      }
    } catch (e) {
      console.warn("Settings sync notice:", e);
    }
  }

  /* =========================================================
     READ-ONLY CMS LOADER
     ========================================================= */
  async function loadCMSContent() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("site_content")
        .select("content_key, content_value, image_url, content_type");

      if (error || !data) return;

      data.forEach(row => {
        const key = row.content_key;
        const val = row.content_value || row.image_url || "";
        const type = row.content_type || "text";

        document.querySelectorAll(`[data-cms-key="${CSS.escape(key)}"]`).forEach(el => {
          if (type === "image" || el.tagName === "IMG") {
            el.src = val;
          } else {
            el.textContent = val;
          }
        });
      });
    } catch (e) {
      console.warn("CMS Load Notice:", e);
    }
  }

  /* =========================================================
     CATALOGUE & PRODUCTS
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
     FIX 2 & 3: PRODUCT DETAIL MODAL (PDP) & RELATED PRODUCTS
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

    // Similar / Related Products (Fix 3)
    let related = liveProducts.filter(item => String(item.id) !== String(p.id) && getCategory(item) === cat);
    if (related.length < 4) {
      const rest = liveProducts.filter(item => String(item.id) !== String(p.id) && getCategory(item) !== cat);
      related = [...related, ...rest].slice(0, 4);
    } else {
      related = related.slice(0, 4);
    }

    const thumbsHtml = images.map((img, i) => `
      <div class="pdp-thumb ${i === 0 ? 'is-active' : ''}" data-pdp-thumb="${i}">
        <img src="${escapeHTML(img)}" alt="Thumbnail ${i + 1}">
      </div>
    `).join('');

    const sizeButtons = ["S", "M", "L", "XL"].map(s => {
      const st = getStock(p, s);
      const isSelected = currentPdpSize === s;
      const isOut = st <= 0;
      return `
        <button type="button" class="pdp-size-btn ${isSelected ? 'is-selected' : ''} ${isOut ? 'is-sold-out' : ''}"
                data-pdp-size="${s}" ${isOut ? 'disabled' : ''}>
          ${s}
        </button>
      `;
    }).join('');

    const relatedHtml = related.map(rel => {
      const rImages = getProductImages(rel);
      return `
        <div class="pdp-related-card" data-action="quickview" data-id="${rel.id}">
          <img src="${escapeHTML(rImages[0])}" alt="${escapeHTML(rel.name)}">
          <div class="pdp-related-meta">
            <strong>${escapeHTML(rel.name)}</strong>
            <span>${formatPrice(rel.price)}</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="pdp-grid">
        <!-- Gallery -->
        <div class="pdp-gallery">
          <div class="pdp-main-image-wrap">
            <img src="${escapeHTML(images[0])}" id="pdpMainImage" class="pdp-main-image" alt="${escapeHTML(p.name)}">
          </div>
          ${images.length > 1 ? `<div class="pdp-thumbnails">${thumbsHtml}</div>` : ''}
        </div>

        <!-- Info -->
        <div class="pdp-info">
          <span class="pdp-korean">${catKorean} · DROP 001</span>
          <h2 class="pdp-title">${escapeHTML(p.name)}</h2>
          <div class="pdp-price">${formatPrice(p.price)}</div>

          <p class="pdp-desc">${escapeHTML(p.description || 'Constructed from heavyweight luxury combed cotton. Tailored with architectural restraint for an elevated, relaxed drape.')}</p>

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

          <div style="font-size:11px; color:#777; line-height:1.6; border-top:1px solid #1a1a1a; padding-top:14px;">
            ✓ 100% Heavyweight Cotton • Relaxed Drop-Shoulder Fit<br>
            ✓ Complimentary Express Shipping across India<br>
            ✓ 7-Day Easy Exchange Policy
          </div>
        </div>
      </div>

      <!-- Related Items -->
      ${related.length > 0 ? `
        <div class="pdp-related">
          <div class="pdp-related-title">SIMILAR SILHOUETTES</div>
          <div class="pdp-related-grid">${relatedHtml}</div>
        </div>
      ` : ''}
    `;

    // Thumbnails switch
    container.querySelectorAll('[data-pdp-thumb]').forEach(tb => {
      tb.addEventListener('click', () => {
        container.querySelectorAll('[data-pdp-thumb]').forEach(t => t.classList.remove('is-active'));
        tb.classList.add('is-active');
        const idx = Number(tb.dataset.pdpThumb);
        const mainImg = document.getElementById('pdpMainImage');
        if (mainImg && images[idx]) mainImg.src = images[idx];
      });
    });

    // Size Switch
    container.querySelectorAll('[data-pdp-size]').forEach(sb => {
      sb.addEventListener('click', () => {
        currentPdpSize = sb.dataset.pdpSize;
        renderPdpView();
      });
    });

    // Qty controls
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

    // Add to Cart from PDP
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
     POLICY DATA
     ========================================================= */
  const POLICY_DATA = {
    faq: {
      title: "FREQUENTLY ASKED QUESTIONS",
      content: `
        <h3>HOW DOES DROP 001 WORK?</h3>
        <p>Drop 001 consists of limited-quantity heavyweight silhouettes. Once sold out, silhouettes will not be restocked immediately.</p>
        <h3>WHAT ARE THE SHIPPING CHARGES?</h3>
        <p>Standard shipping across India is calculated at checkout based on current promotions and cart value.</p>
        <h3>WHAT PAYMENT METHODS DO YOU ACCEPT?</h3>
        <p>We accept Cash on Delivery (COD) across all serviceable pin codes in India.</p>
      `
    },
    shipping: {
      title: "SHIPPING POLICY",
      content: `
        <h3>DISPATCH TIMELINE</h3>
        <p>All orders are confirmed, packed, and handed over to logistics within 24 to 48 hours.</p>
        <h3>DELIVERY TIMELINE</h3>
        <p>Metros: 3–5 business days. Rest of India: 5–7 business days.</p>
        <h3>REAL-TIME TRACKING</h3>
        <p>Use the 'Track Order' option in our header or footer anytime using your Order Number.</p>
      `
    },
    returns: {
      title: "RETURNS & EXCHANGES",
      content: `
        <h3>7-DAY EXCHANGE WINDOW</h3>
        <p>We provide a 7-day size exchange window from the day of delivery, subject to inventory availability.</p>
        <h3>CONDITION</h3>
        <p>Garments must be unworn, unwashed, with all original tags and packaging intact.</p>
        <h3>HOW TO INITIATE</h3>
        <p>Reach out through the email address or WhatsApp channel listed in our contact section with your Order Number.</p>
      `
    },
    privacy: {
      title: "PRIVACY POLICY",
      content: `
        <h3>DATA COLLECTION</h3>
        <p>We only collect name, phone, email, and shipping address details to process orders and track deliveries.</p>
        <h3>SECURITY</h3>
        <p>All records are encrypted through Supabase Row-Level Security and are never sold or rented to third parties.</p>
      `
    },
    terms: {
      title: "TERMS & CONDITIONS",
      content: `
        <h3>PRODUCT AUTHENTICITY</h3>
        <p>All products sold on bulkkot.com are authentic, heavyweight streetwear crafted under strict quality protocols.</p>
        <h3>CANCELLATION</h3>
        <p>Orders can be cancelled before dispatch directly by reaching our team with your Order ID.</p>
      `
    }
  };

  /* =========================================================
     UNIVERSAL MODAL & TRUST ENGINE
     ========================================================= */
  function initModalsAndNavigation() {
    const mobileDrawer = document.querySelector("[data-mobile-drawer]");
    const openDrawerBtn = document.querySelector("[data-open-drawer]");
    const closeDrawerBtns = document.querySelectorAll("[data-close-drawer]");

    openDrawerBtn?.addEventListener("click", () => {
      mobileDrawer?.classList.add("is-open");
      document.body.classList.add("modal-open");
    });

    closeDrawerBtns.forEach(btn => btn.addEventListener("click", () => {
      mobileDrawer?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    }));

    // Policy Modal
    const policyModal = document.querySelector("[data-policy-modal]");
    const policyTitle = policyModal?.querySelector("[data-policy-title]");
    const policyContent = policyModal?.querySelector("[data-policy-content]");
    const closePolicyBtn = policyModal?.querySelector("[data-close-policy]");

    function openPolicy(type) {
      if (!policyModal) return;
      const data = POLICY_DATA[type] || { title: "INFORMATION", content: "<p>Information coming soon.</p>" };
      if (policyTitle) policyTitle.textContent = data.title;
      if (policyContent) policyContent.innerHTML = data.content;
      policyModal.classList.add("is-open");
      policyModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closePolicy() {
      if (!policyModal) return;
      policyModal.classList.remove("is-open");
      policyModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    document.querySelectorAll("[data-open-policy]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openPolicy(btn.dataset.openPolicy);
      });
    });

    closePolicyBtn?.addEventListener("click", closePolicy);
    policyModal?.addEventListener("click", (e) => {
      if (e.target === policyModal) closePolicy();
    });

    // About Story
    const aboutModal = document.querySelector("[data-about-modal]");
    const openAboutBtns = document.querySelectorAll("[data-open-about]");
    const closeAboutBtn = aboutModal?.querySelector("[data-close-about]");

    function openAbout() {
      aboutModal?.classList.add("is-open");
      aboutModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeAbout() {
      aboutModal?.classList.remove("is-open");
      aboutModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    openAboutBtns.forEach(btn => btn.addEventListener("click", openAbout));
    closeAboutBtn?.addEventListener("click", closeAbout);
    aboutModal?.addEventListener("click", (e) => {
      if (e.target === aboutModal) closeAbout();
    });

    // Size Guide
    const sizeModal = document.querySelector("[data-size-guide-modal]");
    const openSizeBtns = document.querySelectorAll("[data-size-guide-open]");
    const closeSizeBtns = sizeModal?.querySelectorAll("[data-size-guide-close]");
    const sizeTabs = sizeModal?.querySelectorAll("[data-size-tab]");
    const sizePanels = sizeModal?.querySelectorAll("[data-size-panel]");

    function openSizeGuide() {
      sizeModal?.classList.add("is-open");
      sizeModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeSizeGuide() {
      sizeModal?.classList.remove("is-open");
      sizeModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    openSizeBtns.forEach(btn => btn.addEventListener("click", openSizeGuide));
    closeSizeBtns?.forEach(btn => btn.addEventListener("click", closeSizeGuide));

    sizeTabs?.forEach(tab => {
      tab.addEventListener("click", () => {
        sizeTabs.forEach(t => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");

        const target = tab.dataset.sizeTab;
        sizePanels?.forEach(p => {
          if (p.dataset.sizePanel === target) {
            p.classList.add("is-active");
            p.hidden = false;
          } else {
            p.classList.remove("is-active");
            p.hidden = true;
          }
        });
      });
    });

    // Search
    const searchModal = document.querySelector("[data-search-modal]");
    const openSearchBtns = document.querySelectorAll("[data-open-search]");
    const closeSearchBtn = searchModal?.querySelector("[data-close-search]");
    const searchForm = document.querySelector("[data-search-form]");

    function openSearch() {
      searchModal?.classList.add("is-open");
      searchModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      setTimeout(() => searchModal?.querySelector("input")?.focus(), 60);
    }

    function closeSearch() {
      searchModal?.classList.remove("is-open");
      searchModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    openSearchBtns.forEach(btn => btn.addEventListener("click", openSearch));
    closeSearchBtn?.addEventListener("click", closeSearch);
    searchModal?.addEventListener("click", (e) => {
      if (e.target === searchModal) closeSearch();
    });

    searchForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      activeSearch = searchForm.querySelector("input")?.value.trim().toLowerCase() || "";
      closeSearch();
      renderProducts(getFilteredProducts());
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    });

    // Tracking
    const trackModal = document.querySelector("[data-track-order-modal]");
    const openTrackBtns = document.querySelectorAll("[data-open-track-order]");
    const closeTrackBtns = trackModal?.querySelectorAll("[data-track-order-close]");
    const trackForm = trackModal?.querySelector("[data-track-order-form]");
    const trackMsg = trackModal?.querySelector("[data-track-order-message]");
    const trackResult = trackModal?.querySelector("[data-track-order-result]");
    const trackAgainBtn = trackModal?.querySelector("[data-track-again]");

    function openTracking() {
      trackModal?.classList.add("is-open");
      trackModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeTracking() {
      trackModal?.classList.remove("is-open");
      trackModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    openTrackBtns.forEach(btn => btn.addEventListener("click", openTracking));
    closeTrackBtns?.forEach(btn => btn.addEventListener("click", closeTracking));

    trackAgainBtn?.addEventListener("click", () => {
      trackResult.hidden = true;
      trackForm.hidden = false;
      if (trackMsg) trackMsg.textContent = "";
    });

    trackForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const orderNumber = trackModal.querySelector("#track-order-number")?.value.trim().toUpperCase();
      const phone = trackModal.querySelector("#track-order-phone")?.value.trim().replace(/\D/g, '');

      if (!orderNumber || !phone) {
        if (trackMsg) trackMsg.textContent = "Please provide both Order Number and Phone.";
        return;
      }

      const submitBtn = trackForm.querySelector(".track-order-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "LOCATING SHIPMENT...";
      if (trackMsg) trackMsg.textContent = "";

      try {
        if (!supabase) throw new Error("Database offline");

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("order_number", orderNumber)
          .maybeSingle();

        if (error || !data) {
          throw new Error("No shipment found matching that Order Number.");
        }

        const dbPhone = String(data.customer_phone || '').replace(/\D/g, '');
        if (!dbPhone.endsWith(phone.slice(-10))) {
          throw new Error("Phone number does not match order records.");
        }

        trackForm.hidden = true;
        trackResult.hidden = false;

        trackResult.querySelector("[data-track-result-number]").textContent = data.order_number;
        const statusEl = trackResult.querySelector("[data-track-result-status]");
        statusEl.textContent = data.order_status || "PLACED";

        const courierEl = trackResult.querySelector("[data-track-result-courier]");
        const trackingNoEl = trackResult.querySelector("[data-track-result-tracking]");

        courierEl.textContent = data.courier || "In Dispatch Preparation";
        trackingNoEl.textContent = data.tracking_number || "Will be assigned on pickup";

        const steps = ["PLACED", "PACKED", "SHIPPED", "OUT FOR DELIVERY", "DELIVERED"];
        const curIdx = steps.indexOf((data.order_status || "PLACED").toUpperCase());
        const fillPct = Math.max(10, Math.min(100, ((curIdx + 1) / steps.length) * 100));

        const line = trackResult.querySelector("[data-track-progress-line]");
        if (line) line.style.width = `${fillPct}%`;

        trackResult.querySelectorAll(".track-step").forEach(stepEl => {
          const sName = stepEl.dataset.trackStep;
          const sIdx = steps.indexOf(sName);
          stepEl.classList.toggle("is-active", sIdx <= curIdx);
          stepEl.classList.toggle("is-current", sIdx === curIdx);
        });

      } catch (err) {
        if (trackMsg) trackMsg.textContent = err.message || "Failed to find order.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "LOOKUP SHIPMENT";
      }
    });

    // Account Modal
    const accountModal = document.querySelector("[data-account-modal]");
    const openAccountBtns = document.querySelectorAll("[data-open-account]");
    const closeAccountBtns = accountModal?.querySelectorAll("[data-account-close]");

    function openAccount() {
      accountModal?.classList.add("is-open");
      accountModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeAccount() {
      accountModal?.classList.remove("is-open");
      accountModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    openAccountBtns.forEach(btn => btn.addEventListener("click", openAccount));
    closeAccountBtns?.forEach(btn => btn.addEventListener("click", closeAccount));

    // PDP Modal Dismissal Listeners
    document.querySelectorAll('[data-pdp-close]').forEach(el => {
      el.addEventListener('click', closePdpModal);
    });

    // Global ESC key dismiss
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePolicy();
        closeAbout();
        closeSizeGuide();
        closeSearch();
        closeTracking();
        closeAccount();
        closePdpModal();
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
        window.BULKKOT_CART.addItem({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          size: size,
          image: images[0]
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
