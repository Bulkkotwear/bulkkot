/**
 * BULKKOT — Dynamic Main Controller
 */
(function () {
  'use strict';

  // Supabase Init
  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  let liveProducts = [];
  const selectedSizes = {};

  // 1. Fetch & Render Dynamic Catalog
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

      if (!liveProducts.length) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">No drops currently live. Join waitlist below.</p>`;
        return;
      }

      renderProducts(liveProducts);
    } catch (err) {
      console.error("Products load err:", err);
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #e50914; padding: 40px;">Failed to load catalog.</p>`;
    }
  }

  function renderProducts(items) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">No matching pieces found.</p>`;
      return;
    }

    grid.innerHTML = items.map(p => {
      const cat = (p.category || "tees").toLowerCase();
      const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
      const stock = p.stock || {};
      const sizes = ["S", "M", "L", "XL"];
      
      const totalStock = Object.values(stock).reduce((a, b) => Number(a) + Number(b), 0);
      const isSoldOut = totalStock <= 0;

      if (!selectedSizes[p.id]) {
        selectedSizes[p.id] = sizes.find(s => (stock[s] || 0) > 0) || "M";
      }

      const sizePills = sizes.map(s => {
        const qty = stock[s] || 0;
        const isSel = selectedSizes[p.id] === s;
        const disabled = qty <= 0;
        return `
          <button type="button" 
            style="padding: 4px 10px; font-size: 11px; font-weight: 700; border: 1px solid ${isSel ? '#fff' : '#333'}; background: ${isSel ? '#fff' : 'transparent'}; color: ${isSel ? '#000' : '#fff'}; cursor: ${disabled ? 'not-allowed' : 'pointer'}; opacity: ${disabled ? 0.3 : 1}; margin-right: 4px; margin-bottom: 6px; border-radius: 2px;"
            ${disabled ? 'disabled' : ''}
            onclick="window.selectBulkSize('${p.id}', '${s}')">
            ${s}
          </button>
        `;
      }).join("");

      return `
        <article class="product-card" data-product-card data-category="${cat}">
          <div class="product-image" style="position: relative;">
            <img src="${p.image_url || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png'}" alt="${p.name}" loading="lazy">
            <span class="product-status">${isSoldOut ? 'SOLD OUT' : 'DROP 001'}</span>
          </div>
          <div class="product-information" style="padding: 16px 0; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <h3 style="font-size: 15px; font-weight: 800; text-transform: uppercase;">${p.name}</h3>
              <span style="font-weight: 700; font-size: 14px;">₹${p.price || 0}</span>
            </div>
            <p style="font-size: 12px; color: #888; margin-top: -4px;">${catKorean}</p>
            
            <div style="display: flex; flex-wrap: wrap; margin-top: 4px;">${sizePills}</div>
            
            <button type="button" 
              class="button button--primary" 
              style="width: 100%; margin-top: 8px; padding: 10px 0; font-size: 11px; letter-spacing: 0.1em;"
              ${isSoldOut ? 'disabled' : ''}
              onclick="window.addBulkToBag('${p.id}')">
              ${isSoldOut ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  window.selectBulkSize = function (id, size) {
    selectedSizes[id] = size;
    renderProducts(liveProducts);
  };

  window.addBulkToBag = function (id) {
    const p = liveProducts.find(i => String(i.id) === String(id));
    if (!p) return;
    const size = selectedSizes[p.id] || "M";

    if (window.BULKKOT_CART && typeof window.BULKKOT_CART.addItem === "function") {
      window.BULKKOT_CART.addItem({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        size: size,
        image: p.image_url
      });
    }
  };

  // 2. VIP Waitlist Hook
  function initWaitlist() {
    const form = document.querySelector("[data-waitlist-form]");
    const msg = document.querySelector("[data-waitlist-message]");
    if (!form || !supabase) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const input = document.getElementById("waitlist-email");
      const email = input ? input.value.trim() : "";
      if (!email) return;

      const btn = form.querySelector("button[type='submit']");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "...";
      }

      try {
        const { error } = await supabase.from("waitlist").insert([{ email: email }]);
        if (error) throw error;

        if (msg) {
          msg.textContent = "You're on the VIP list. Access code will be emailed.";
          msg.style.color = "#31c48d";
        }
        form.reset();
      } catch (err) {
        if (msg) {
          msg.textContent = err.message || "Failed to join. Please try again.";
          msg.style.color = "#e50914";
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "JOIN";
        }
      }
    });
  }

  // 3. Category Filter
  function initCategoryFilter() {
    document.querySelectorAll("[data-category]").forEach(el => {
      el.addEventListener("click", (e) => {
        const cat = el.getAttribute("data-category");
        if (!cat) return;
        if (cat === "all") {
          renderProducts(liveProducts);
        } else {
          renderProducts(liveProducts.filter(p => (p.category || "").toLowerCase() === cat.toLowerCase()));
        }
      });
    });
  }

  // 4. Search Filter
  function initSearch() {
    const form = document.querySelector("[data-search-form]");
    const input = document.getElementById("site-search");
    if (!form || !input) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim().toLowerCase();
      const modal = document.querySelector("[data-search-modal]");
      if (modal) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
      }
      if (!q) {
        renderProducts(liveProducts);
      } else {
        renderProducts(liveProducts.filter(p => (p.name || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)));
      }
      const shopSec = document.getElementById("shop");
      if (shopSec) shopSec.scrollIntoView({ behavior: "smooth" });
    });
  }

  // 5. Drawer & Modals UI
  function initUI() {
    const openDrawerBtn = document.querySelector("[data-open-drawer]");
    const closeDrawerBtn = document.querySelector("[data-close-drawer]");
    const drawer = document.getElementById("mobile-drawer");

    openDrawerBtn?.addEventListener("click", () => {
      drawer?.classList.add("is-open");
      drawer?.setAttribute("aria-hidden", "false");
    });
    closeDrawerBtn?.addEventListener("click", () => {
      drawer?.classList.remove("is-open");
      drawer?.setAttribute("aria-hidden", "true");
    });

    const openSearchBtn = document.querySelector("[data-open-search]");
    const closeSearchBtn = document.querySelector("[data-close-search]");
    const searchModal = document.querySelector("[data-search-modal]");

    openSearchBtn?.addEventListener("click", () => {
      searchModal?.classList.add("is-open");
      searchModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    });
    closeSearchBtn?.addEventListener("click", () => {
      searchModal?.classList.remove("is-open");
      searchModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    });

    const openAboutBtn = document.querySelector("[data-open-about]");
    const closeAboutBtn = document.querySelector("[data-close-about]");
    const aboutModal = document.querySelector("[data-about-modal]");

    openAboutBtn?.addEventListener("click", () => {
      aboutModal?.classList.add("is-open");
      aboutModal?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    });
    closeAboutBtn?.addEventListener("click", () => {
      aboutModal?.classList.remove("is-open");
      aboutModal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    });
  }

  // DOM Ready
  document.addEventListener("DOMContentLoaded", () => {
    initCatalog();
    initWaitlist();
    initCategoryFilter();
    initSearch();
    initUI();
  });
})();
