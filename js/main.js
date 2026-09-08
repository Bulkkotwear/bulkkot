/**
 * BULKKOT — Production Main Storefront Engine
 * Safe Read-Only CMS Binding & Product Catalog
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

  /* =========================================================
     READ-ONLY CMS LOADER (Customer Safe)
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

      const sizePills = ["S", "M", "L", "XL"].map(s => {
        const qty = getStock(p, s);
        const sel = curSize === s;
        return `<button type="button" class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}" data-action="size" data-id="${p.id}" data-size="${s}">${s}</button>`;
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
            <button type="button" class="button button--primary product-add-button" data-action="add" data-id="${p.id}" ${badge.disabled ? 'disabled' : ''}>
              ${badge.disabled ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  /* =========================================================
     NAVIGATION, SEARCH & MODAL CONTROLS
     ========================================================= */
  function initNavigation() {
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

    // Search Modal
    const searchModal = document.querySelector("[data-search-modal]");
    const openSearchBtns = document.querySelectorAll("[data-open-search]");
    const closeSearchBtn = searchModal?.querySelector(".drawer-close");
    const searchForm = document.querySelector("[data-search-form]");

    openSearchBtns.forEach(btn => btn.addEventListener("click", () => {
      searchModal?.classList.add("is-open");
      document.body.classList.add("modal-open");
      setTimeout(() => searchModal?.querySelector("input")?.focus(), 50);
    }));

    closeSearchBtn?.addEventListener("click", () => {
      searchModal?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    });

    searchForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      activeSearch = searchForm.querySelector("input")?.value.trim().toLowerCase() || "";
      searchModal?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      renderProducts(getFilteredProducts());
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    });

    // Policy Modals Wiring (Fix for Priority 4)
    const policyModal = document.querySelector("[data-policy-modal]");
    const policyTitle = document.querySelector("[data-policy-title]");
    const policyContent = document.querySelector("[data-policy-content]");
    const closePolicyBtn = policyModal?.querySelector(".drawer-close");

    document.querySelectorAll("[data-open-policy]").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.openPolicy;
        const template = document.getElementById(`policy-${type}`);
        if (!template || !policyModal) return;

        if (policyTitle) policyTitle.textContent = btn.textContent.trim().toUpperCase();
        if (policyContent) policyContent.innerHTML = template.innerHTML;

        policyModal.classList.add("is-open");
        document.body.classList.add("modal-open");
      });
    });

    closePolicyBtn?.addEventListener("click", () => {
      policyModal?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    });

    // Size Guide Modal
    const sizeModal = document.querySelector("[data-size-guide-modal]");
    const openSizeBtns = document.querySelectorAll("[data-size-guide-open]");
    const closeSizeBtn = sizeModal?.querySelector("[data-size-guide-close]");

    openSizeBtns.forEach(btn => btn.addEventListener("click", () => {
      sizeModal?.classList.add("is-open");
      document.body.classList.add("modal-open");
    }));

    closeSizeBtn?.addEventListener("click", () => {
      sizeModal?.classList.remove("is-open");
      document.body.classList.remove("modal-open");
    });
  }

  // Event Delegation for Sizes & Add to Cart
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
      if (window.BULKKOT_CART?.addItem) {
        window.BULKKOT_CART.addItem({
          id: p.id,
          name: p.name,
          price: Number(p.price || 0),
          size: size,
          image: p.image_url
        });
      }
    }
  });

  // Re-fetch catalog when order completes
  window.addEventListener('bulkkot:order-completed', () => {
    initCatalog();
  });

  // Init Storefront
  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initCatalog();
    loadCMSContent();

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
