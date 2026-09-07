/**
 * BULKKOT — Production Main Storefront Controller
 * Version: 2.0
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

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPrice(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN");
  }

  function getStock(product, size) {
    return Number(product?.stock?.[size] || 0);
  }

  function getTotalStock(product) {
    const stock = product?.stock || {};
    return ["S", "M", "L", "XL"].reduce((total, size) => total + Number(stock[size] || 0), 0);
  }

  function getCategory(product) {
    return String(product?.category || "tees").toLowerCase();
  }

  function getProductText(product) {
    return [product?.name, product?.category, product?.description, product?.fabric, product?.fit, product?.drop]
      .filter(Boolean).join(" ").toLowerCase();
  }

  async function initCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!supabase) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">Store connection unavailable.</p>';
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
      liveProducts.forEach(initializeSelectedSize);
      renderProducts(getVisibleProducts());
    } catch (error) {
      console.error("BULKKOT catalog error:", error);
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #e50914; padding: 40px;">Failed to load catalog.</p>';
    }
  }

  function initializeSelectedSize(product) {
    if (selectedSizes[product.id]) return;
    const sizes = ["S", "M", "L", "XL"];
    const available = sizes.find(size => getStock(product, size) > 0);
    selectedSizes[product.id] = available || "M";
  }

  function getVisibleProducts() {
    let products = [...liveProducts];
    if (activeCategory !== "all") {
      products = products.filter(product => getCategory(product) === activeCategory);
    }
    if (activeSearch) {
      products = products.filter(product => getProductText(product).includes(activeSearch));
    }
    if (activeSort === "price-low") {
      products.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (activeSort === "price-high") {
      products.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (activeSort === "newest") {
      products.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return products;
  }

  function refreshCatalog() {
    renderProducts(getVisibleProducts());
  }

  function renderProducts(products) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">No matching pieces found.</p>';
      return;
    }

    grid.innerHTML = products.map(renderProductCard).join("");
    bindProductEvents();
  }

  function renderProductCard(product) {
    initializeSelectedSize(product);
    const category = getCategory(product);
    const categoryKorean = category === "hoods" ? "후드" : category === "sweats" ? "스웨트" : "티셔츠";
    const totalStock = getTotalStock(product);
    const soldOut = totalStock <= 0;
    const selectedSize = selectedSizes[product.id];
    const sizes = ["S", "M", "L", "XL"];

    const sizePills = sizes.map(size => {
      const stock = getStock(product, size);
      const isSelected = selectedSize === size;
      return `
        <button type="button"
          style="padding: 4px 10px; font-size: 11px; font-weight: 700; border: 1px solid ${isSelected ? '#fff' : '#333'}; background: ${isSelected ? '#fff' : 'transparent'}; color: ${isSelected ? '#000' : '#fff'}; cursor: ${stock <= 0 ? 'not-allowed' : 'pointer'}; opacity: ${stock <= 0 ? 0.3 : 1}; margin-right: 4px; margin-bottom: 6px; border-radius: 2px;"
          data-size-product="${escapeHTML(String(product.id))}"
          data-size="${size}"
          ${stock <= 0 ? "disabled" : ""}>
          ${size}
        </button>
      `;
    }).join("");

    const image = product.image_url || "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";

    return `
      <article class="product-card" data-product-card data-category="${escapeHTML(category)}">
        <div class="product-image" style="cursor: pointer;" data-product-view="${escapeHTML(String(product.id))}">
          <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy">
          <span class="product-status">${soldOut ? "SOLD OUT" : escapeHTML(product.drop || "DROP 001")}</span>
        </div>
        <div class="product-information" style="padding: 16px 0; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h3 style="font-size: 15px; font-weight: 800; text-transform: uppercase;">${escapeHTML(product.name)}</h3>
            <span style="font-weight: 700; font-size: 14px;">${formatPrice(product.price)}</span>
          </div>
          <p style="font-size: 12px; color: #888; margin-top: -4px;">${categoryKorean}</p>
          <div style="display: flex; flex-wrap: wrap; margin-top: 4px;">${sizePills}</div>
          <button type="button"
            class="button button--primary"
            style="width: 100%; margin-top: 8px; padding: 10px 0; font-size: 11px; letter-spacing: 0.1em;"
            data-add-product="${escapeHTML(String(product.id))}"
            ${soldOut ? "disabled" : ""}>
            ${soldOut ? "SOLD OUT" : "ADD TO BAG"}
          </button>
        </div>
      </article>
    `;
  }

  function bindProductEvents() {
    document.querySelectorAll("[data-size-product]").forEach(button => {
      button.addEventListener("click", () => {
        selectedSizes[button.dataset.sizeProduct] = button.dataset.size;
        refreshCatalog();
      });
    });

    document.querySelectorAll("[data-add-product]").forEach(button => {
      button.addEventListener("click", () => addProductToCart(button.dataset.addProduct));
    });

    document.querySelectorAll("[data-product-view]").forEach(elem => {
      elem.addEventListener("click", () => openProductModal(elem.dataset.productView));
    });
  }

  function addProductToCart(id) {
    const product = liveProducts.find(item => String(item.id) === String(id));
    if (!product) return;
    const size = selectedSizes[product.id] || "M";
    if (getStock(product, size) <= 0) return;

    if (window.BULKKOT_CART && typeof window.BULKKOT_CART.addItem === "function") {
      window.BULKKOT_CART.addItem({
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        size,
        image: product.image_url || ""
      });
    }
  }

  function ensureProductModal() {
    let modal = document.getElementById("product-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "product-modal";
    modal.className = "content-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="content-modal__panel product-detail-panel" style="max-width: 600px;">
        <button type="button" class="drawer-close" data-product-modal-close aria-label="Close product">×</button>
        <div id="product-modal-content"></div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector("[data-product-modal-close]")?.addEventListener("click", closeProductModal);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeProductModal();
    });
    return modal;
  }

  function openProductModal(id) {
    const product = liveProducts.find(item => String(item.id) === String(id));
    if (!product) return;
    initializeSelectedSize(product);

    const modal = ensureProductModal();
    const content = modal.querySelector("#product-modal-content");
    if (!content) return;

    const sizes = ["S", "M", "L", "XL"];
    const image = product.image_url || "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";

    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" style="width: 100%; max-height: 380px; object-fit: cover;">
        <div>
          <p class="eyebrow">${escapeHTML(product.drop || "DROP 001")}</p>
          <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">${escapeHTML(product.name)}</h2>
          <p style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">${formatPrice(product.price)}</p>
          ${product.description ? `<p style="color: #aaa; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">${escapeHTML(product.description)}</p>` : ""}
          <div style="margin-bottom: 16px;">
            <p style="font-size: 11px; font-weight: 700; margin-bottom: 8px;">SELECT SIZE</p>
            <div style="display: flex; gap: 8px;">
              ${sizes.map(size => {
                const stock = getStock(product, size);
                const selected = selectedSizes[product.id] === size;
                return `
                  <button type="button"
                    style="padding: 8px 14px; font-size: 12px; font-weight: 700; border: 1px solid ${selected ? '#fff' : '#333'}; background: ${selected ? '#fff' : 'transparent'}; color: ${selected ? '#000' : '#fff'}; cursor: ${stock <= 0 ? 'not-allowed' : 'pointer'}; opacity: ${stock <= 0 ? 0.3 : 1};"
                    data-modal-size="${size}"
                    ${stock <= 0 ? "disabled" : ""}>
                    ${size}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
          <button type="button" class="button button--primary" id="product-modal-add" style="width: 100%; padding: 14px 0;"
            ${getTotalStock(product) <= 0 ? "disabled" : ""}>
            ${getTotalStock(product) <= 0 ? "SOLD OUT" : "ADD TO BAG"}
          </button>
        </div>
      </div>
    `;

    content.querySelectorAll("[data-modal-size]").forEach(button => {
      button.addEventListener("click", () => {
        selectedSizes[product.id] = button.dataset.modalSize;
        openProductModal(product.id);
      });
    });

    content.querySelector("#product-modal-add")?.addEventListener("click", () => {
      addProductToCart(product.id);
      closeProductModal();
    });

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeProductModal() {
    const modal = document.getElementById("product-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".cart-drawer.is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function initWaitlist() {
    const form = document.querySelector("[data-waitlist-form]");
    const message = document.querySelector("[data-waitlist-message]");
    if (!form || !supabase) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const input = document.getElementById("waitlist-email");
      const email = input?.value.trim().toLowerCase() || "";
      const button = form.querySelector("button[type='submit']");

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (message) {
          message.textContent = "Please enter a valid email address.";
          message.style.color = "#e50914";
        }
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = "JOINING...";
      }

      try {
        const { error } = await supabase.from("waitlist").insert([{ email }]);
        if (error) {
          if (String(error.code) === "23505") {
            throw new Error("You're already on the VIP waitlist.");
          }
          throw error;
        }
        if (message) {
          message.textContent = "You're on the VIP list. We'll keep you updated.";
          message.style.color = "#31c48d";
        }
        form.reset();
      } catch (error) {
        if (message) {
          message.textContent = error.message || "Could not join the waitlist. Please try again.";
          message.style.color = "#e50914";
        }
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "JOIN";
        }
      }
    });
  }

  function initCategoryFilter() {
    document.querySelectorAll(".category-card[data-category]").forEach(card => {
      card.addEventListener("click", () => {
        activeCategory = String(card.dataset.category || "all").toLowerCase();
        refreshCatalog();
        setTimeout(() => {
          document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      });
    });
  }

  function initSearch() {
    const form = document.querySelector("[data-search-form]");
    const input = document.getElementById("site-search");
    if (!form || !input) return;

    form.addEventListener("submit", event => {
      event.preventDefault();
      activeSearch = input.value.trim().toLowerCase();
      const modal = document.querySelector("[data-search-modal]");
      modal?.classList.remove("is-open");
      modal?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      refreshCatalog();
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function initUI() {
    const drawer = document.getElementById("mobile-drawer");
    document.querySelectorAll("[data-open-drawer]").forEach(btn => {
      btn.addEventListener("click", () => drawer?.classList.add("is-open"));
    });
    document.querySelectorAll("[data-close-drawer]").forEach(btn => {
      btn.addEventListener("click", () => drawer?.classList.remove("is-open"));
    });

    const searchModal = document.querySelector("[data-search-modal]");
    document.querySelectorAll("[data-open-search]").forEach(btn => {
      btn.addEventListener("click", () => {
        searchModal?.classList.add("is-open");
        document.body.classList.add("modal-open");
        setTimeout(() => document.getElementById("site-search")?.focus(), 50);
      });
    });
    document.querySelectorAll("[data-close-search]").forEach(btn => {
      btn.addEventListener("click", () => {
        searchModal?.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      });
    });

    const aboutModal = document.querySelector("[data-about-modal]");
    document.querySelectorAll("[data-open-about]").forEach(btn => {
      btn.addEventListener("click", () => {
        aboutModal?.classList.add("is-open");
        document.body.classList.add("modal-open");
      });
    });
    document.querySelectorAll("[data-close-about]").forEach(btn => {
      btn.addEventListener("click", () => {
        aboutModal?.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initCatalog();
    initWaitlist();
    initCategoryFilter();
    initSearch();
    initUI();
  });
})();
