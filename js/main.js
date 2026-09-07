/**
 * BULKKOT — Fixed Storefront Controller
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
    return Number(product?.stock?.[size] || 0);
  }

  function getTotalStock(product) {
    const stock = product?.stock || {};
    return ["S", "M", "L", "XL"].reduce((tot, s) => tot + Number(stock[s] || 0), 0);
  }

  function getCategory(product) {
    return String(product?.category || "tees").toLowerCase();
  }

  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!supabase) {
      grid.innerHTML = '<p class="catalog-message">Database connection unavailable.</p>';
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
      console.error(err);
      grid.innerHTML = '<p class="catalog-message catalog-message--error">Failed to load catalog.</p>';
    }
  }

  function getFilteredProducts() {
    let list = [...liveProducts];
    if (activeCategory !== "all") {
      list = list.filter(p => getCategory(p) === activeCategory);
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
      grid.innerHTML = '<p class="catalog-message">No garments found in this category.</p>';
      return;
    }

    grid.innerHTML = items.map(p => {
      const cat = getCategory(p);
      const catKorean = cat === "hoods" ? "후드" : (cat === "sweats" ? "스웨트" : "티셔츠");
      const isSoldOut = getTotalStock(p) <= 0;
      const curSize = selectedSizes[p.id] || "M";

      const sizePills = ["S", "M", "L", "XL"].map(s => {
        const qty = getStock(p, s);
        const sel = curSize === s;
        return `
          <button type="button" 
            class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}" 
            data-action="size" data-id="${p.id}" data-size="${s}" 
            ${qty <= 0 ? 'disabled' : ''}>
            ${s}
          </button>
        `;
      }).join('');

      return `
        <article class="product-card" data-category="${cat}">
          <div class="product-card__thumb" data-action="view" data-id="${p.id}">
            <img src="${escapeHTML(p.image_url || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}" alt="${escapeHTML(p.name)}" loading="lazy">
            <span class="product-status">${isSoldOut ? 'SOLD OUT' : 'DROP 001'}</span>
            <div class="product-card__hover-overlay"><span>QUICK VIEW</span></div>
          </div>
          <div class="product-information">
            <div class="product-information__header" data-action="view" data-id="${p.id}" style="cursor:pointer;">
              <div>
                <h3>${escapeHTML(p.name)}</h3>
                <p class="product-category">${catKorean}</p>
              </div>
              <span class="product-price">${formatPrice(p.price)}</span>
            </div>
            <div class="product-sizes">${sizePills}</div>
            <button type="button" class="button button--primary product-add-button" 
              data-action="add" data-id="${p.id}" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? 'SOLD OUT' : 'ADD TO BAG'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Event Delegation (Click issues fix karne ke liye)
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const p = liveProducts.find(item => String(item.id) === String(id));

    if (action === "size") {
      selectedSizes[id] = btn.dataset.size;
      renderProducts(getFilteredProducts());
    } else if (action === "add" && p) {
      const size = selectedSizes[id] || "M";
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
    const isSoldOut = getTotalStock(p) <= 0;

    modal.innerHTML = `
      <div class="content-modal__panel product-modal-box">
        <button type="button" class="drawer-close" id="closeDetailModal">×</button>
        <div class="product-modal-grid">
          <div class="product-modal-img">
            <img src="${escapeHTML(p.image_url || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}" alt="${escapeHTML(p.name)}">
          </div>
          <div class="product-modal-details">
            <p class="eyebrow">${escapeHTML(p.category || 'ESSENTIALS')}</p>
            <h2>${escapeHTML(p.name)}</h2>
            <div class="product-modal-price">${formatPrice(p.price)}</div>
            <p class="product-modal-desc">${escapeHTML(p.description || 'Korean-inspired heavyweight minimalist everyday wear.')}</p>
            
            <div style="margin: 20px 0;">
              <p style="font-size:11px; font-weight:700; margin-bottom:8px; letter-spacing:0.1em;">SELECT SIZE</p>
              <div class="product-sizes">
                ${["S", "M", "L", "XL"].map(s => {
                  const qty = getStock(p, s);
                  const sel = curSize === s;
                  return `
                    <button type="button" class="product-size-btn ${sel ? 'is-selected' : ''} ${qty <= 0 ? 'is-disabled' : ''}"
                      data-modal-size="${s}" ${qty <= 0 ? 'disabled' : ''}>
                      ${s}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <button type="button" class="button button--primary" id="modalAddToCart" style="width:100%; padding:14px;" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? 'SOLD OUT' : 'ADD TO BAG'}
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
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  // Filter & Toolbar Controls
  document.addEventListener("DOMContentLoaded", () => {
    initCatalog();

    // Category Buttons
    document.querySelectorAll("[data-shop-category]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-shop-category]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeCategory = btn.dataset.shopCategory;
        renderProducts(getFilteredProducts());
      });
    });

    // Sort Dropdown
    const sortSelect = document.getElementById("shop-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        activeSort = sortSelect.value;
        renderProducts(getFilteredProducts());
      });
    }

    // Escape listener
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".content-modal.is-open").forEach(closeModal);
      }
    });
  });
})();
