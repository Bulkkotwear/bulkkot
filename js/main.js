/**
 * BULKKOT — Production Main Storefront & Visual In-Context CMS
 * Version: 4.0 (Click-To-Edit Visual CMS Engine)
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
     BULKKOT — VISUAL IN-CONTEXT CMS (CLICK TO EDIT)
     ========================================================= */
  const BULKKOT_CMS = (() => {
    let cmsEnabled = false;
    let contentCache = {};
    let activeEditor = null;

    async function checkAdmin() {
      if (!supabase) return false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) return true;
        // Check if admin session exists in localStorage
        const adminStorage = localStorage.getItem("bulkkot-admin-auth");
        if (adminStorage && adminStorage.includes("access_token")) return true;
        return false;
      } catch (err) {
        return false;
      }
    }

    async function loadContent() {
      if (!supabase) return;
      try {
        const { data, error } = await supabase.from("site_content").select("*");
        if (error) throw error;
        contentCache = {};
        (data || []).forEach(row => {
          contentCache[row.content_key] = row;
        });
        applyContent();
      } catch (e) {
        console.warn("CMS Content Load Error:", e);
      }
    }

    function applyContent() {
      document.querySelectorAll("[data-cms-key]").forEach(el => {
        const key = el.dataset.cmsKey;
        const row = contentCache[key];
        if (!row) return;

        const val = row.content_value || row.image_url || "";
        const type = el.dataset.cmsType || row.content_type || "text";

        if (type === "image") {
          if (el.tagName === "IMG") el.src = val;
          else el.style.backgroundImage = `url("${val}")`;
        } else {
          el.textContent = val;
        }
      });
    }

    async function saveContent(key, value, type = "text") {
      if (!supabase) throw new Error("Database offline");

      const isImg = type === "image";
      const payload = {
        content_key: key,
        content_value: isImg ? null : value,
        image_url: isImg ? value : null,
        content_type: isImg ? "image" : "text",
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("site_content").upsert(payload, { onConflict: "content_key" });
      if (error) throw error;

      contentCache[key] = payload;

      document.querySelectorAll(`[data-cms-key="${CSS.escape(key)}"]`).forEach(el => {
        if (isImg) {
          if (el.tagName === "IMG") el.src = value;
          else el.style.backgroundImage = `url("${value}")`;
        } else {
          el.textContent = value;
        }
      });
    }

    function createToolbar() {
      if (document.querySelector("[data-bulkkot-cms-toolbar]")) return;
      const tb = document.createElement("div");
      tb.setAttribute("data-bulkkot-cms-toolbar", "");
      tb.innerHTML = `
        <div class="bulkkot-cms-brand">
          <span class="bulkkot-cms-dot"></span>
          BULKKOT LIVE CMS
        </div>
        <span class="bulkkot-cms-status">CLICK TO EDIT ON</span>
        <button type="button" data-cms-exit>EXIT</button>
      `;
      document.body.appendChild(tb);
      tb.querySelector("[data-cms-exit]").addEventListener("click", () => disable());
    }

    function openEditor(element) {
      closeEditor();
      const key = element.dataset.cmsKey;
      const type = element.dataset.cmsType || (contentCache[key]?.content_type) || "text";
      const current = contentCache[key]?.content_value || contentCache[key]?.image_url || (element.tagName === "IMG" ? element.src : element.textContent.trim());

      const editor = document.createElement("div");
      editor.setAttribute("data-bulkkot-cms-editor", "");

      if (type === "image") {
        editor.innerHTML = `
          <div class="bulkkot-cms-editor-title">EDIT PHOTO</div>
          <div class="bulkkot-cms-editor-label">${escapeHTML(key)}</div>
          <input type="url" class="bulkkot-cms-input" value="${escapeHTML(current)}" placeholder="Paste Image URL" data-cms-value>
          <div class="bulkkot-cms-editor-actions">
            <button type="button" data-cms-cancel>CANCEL</button>
            <button type="button" class="primary" data-cms-save>SAVE LIVE</button>
          </div>
        `;
      } else {
        editor.innerHTML = `
          <div class="bulkkot-cms-editor-title">EDIT CONTENT</div>
          <div class="bulkkot-cms-editor-label">${escapeHTML(key)}</div>
          <textarea class="bulkkot-cms-input bulkkot-cms-textarea" data-cms-value>${escapeHTML(current)}</textarea>
          <div class="bulkkot-cms-editor-actions">
            <button type="button" data-cms-cancel>CANCEL</button>
            <button type="button" class="primary" data-cms-save>SAVE LIVE</button>
          </div>
        `;
      }

      document.body.appendChild(editor);
      activeEditor = editor;

      // Position editor near element
      const rect = element.getBoundingClientRect();
      let top = rect.bottom + 10;
      let left = Math.max(16, Math.min(rect.left, window.innerWidth - 360));
      if (top + 200 > window.innerHeight) top = Math.max(16, rect.top - 210);
      editor.style.top = `${top}px`;
      editor.style.left = `${left}px`;

      editor.querySelector("[data-cms-cancel]").onclick = closeEditor;
      editor.querySelector("[data-cms-save]").onclick = async () => {
        const val = editor.querySelector("[data-cms-value]").value.trim();
        const btn = editor.querySelector("[data-cms-save]");
        btn.disabled = true;
        btn.textContent = "SAVING...";
        try {
          await saveContent(key, val, type);
          showToast("Saved live to BULKKOT!");
          closeEditor();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "SAVE LIVE";
          alert("Error: " + err.message);
        }
      };

      editor.querySelector("[data-cms-value]")?.focus();
    }

    function closeEditor() {
      if (activeEditor) {
        activeEditor.remove();
        activeEditor = null;
      }
    }

    function showToast(msg) {
      let t = document.querySelector("[data-bulkkot-cms-toast]");
      if (!t) {
        t = document.createElement("div");
        t.setAttribute("data-bulkkot-cms-toast", "");
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 3000);
    }

    function enable() {
      cmsEnabled = true;
      document.body.classList.add("bulkkot-cms-active");
      createToolbar();
      showToast("Live Visual Editing Mode Enabled! Click any text/photo.");
    }

    function disable() {
      cmsEnabled = false;
      closeEditor();
      document.body.classList.remove("bulkkot-cms-active");
      document.querySelector("[data-bulkkot-cms-toolbar]")?.remove();
    }

    function bindEvents() {
      document.addEventListener("click", (e) => {
        if (!cmsEnabled) return;
        if (e.target.closest("[data-bulkkot-cms-toolbar], [data-bulkkot-cms-editor], [data-bulkkot-cms-toast]")) return;

        const target = e.target.closest("[data-cms-key]");
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();
        openEditor(target);
      }, true);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeEditor();
      });
    }

    async function init() {
      bindEvents();
      await loadContent();
      const isAdmin = await checkAdmin();
      if (isAdmin) enable();
    }

    return { init, enable, disable, loadContent };
  })();

  // STOREFRONT NAVIGATION & MODALS
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

    // Search modal
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

    // About story modal
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
  }

  // CATALOGUE
  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid || !supabase) return;

    try {
      const { data, error } = await supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false });
      if (error) throw error;
      liveProducts = data || [];
      liveProducts.forEach(p => {
        selectedSizes[p.id] = ["S", "M", "L", "XL"].find(s => getStock(p, s) > 0) || "M";
      });
      renderProducts(getFilteredProducts());
    } catch (err) {
      grid.innerHTML = '<p class="catalog-message">Failed to load catalog.</p>';
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
        window.BULKKOT_CART.addItem({ id: p.id, name: p.name, price: Number(p.price || 0), size: size, image: p.image_url });
      }
    }
  });

  // INITIALIZATION
  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initCatalog();
    BULKKOT_CMS.init();

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
window.addEventListener('bulkkot:order-completed', () => {
  if (typeof initCatalog === 'function') {
    initCatalog();
  }
});
