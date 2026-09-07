/**
 * BULKKOT — Production Main Storefront Controller
 * Version: 3.3 (Real-Time Low Stock + Size Guide Integration)
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
      grid.innerHTML = '<p class="catalog-message" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">No garments found in this category.</p>';
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

  // Unified Click Event Delegation
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

  // SIZE GUIDE LOGIC
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
    if (!document.querySelector(".content-modal.is-open") && !document.querySelector(".cart-drawer.is-open")) {
      document.body.classList.remove("modal-open");
    }
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
    initCatalog();
    initCarousel();
    initSizeGuide();

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
      }
    });
  });
})();
