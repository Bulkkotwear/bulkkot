/**
 * BULKKOT (불꽃) — E-COMMERCE CART & CHECKOUT ENGINE
 * Production Hardened / Identity Bound
 *
 * Responsibilities:
 * - Persistent cart state
 * - Coupon persistence / calculation
 * - Stock reconciliation
 * - Cart drawer rendering
 * - Cart open / close controls
 * - Order-completion UI refresh integration
 */
(() => {
  "use strict";

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";
  const CART_STORAGE_KEY = "bulk_kot_cart_v2";
  const COUPON_STORAGE_KEY = "bulk_kot_coupon_v2";
  const FALLBACK_IMAGE = "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png";
  const MAX_QTY = 99;

  const supabaseClient = window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  let cart = [];
  let appliedCoupon = null;
  let isSubmittingOrder = false;

  /* =========================================================
     SAFE STORAGE + NORMALIZATION
     ========================================================= */

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn("BULKKOT storage read failed:", error);
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("BULKKOT storage write failed:", error);
      return false;
    }
  }

  function safeStorageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("BULKKOT storage remove failed:", error);
    }
  }

  function normalizeQuantity(value, fallback = 1) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(MAX_QTY, Math.max(0, Math.floor(num)));
  }

  function normalizeCartItem(item) {
    if (!item || item.id == null || item.size == null) return null;

    const id = String(item.id).trim();
    const size = String(item.size).trim().toUpperCase();

    if (!id || !size) return null;

    const quantity = normalizeQuantity(item.quantity, 1);
    if (quantity <= 0) return null;

    return {
      id,
      name: String(item.name || "Garment").trim() || "Garment",
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      size,
      image: typeof item.image === "string" ? item.image : "",
      quantity
    };
  }

  function normalizeCoupon(coupon) {
    if (!coupon || typeof coupon !== "object") return null;

    const code = String(coupon.code || "").trim().toUpperCase();
    const type = String(coupon.type || "").trim().toLowerCase();
    const value = Number(coupon.value);

    if (!code || !["percent", "fixed"].includes(type)) return null;
    if (!Number.isFinite(value) || value < 0) return null;
    if (type === "percent" && value > 100) return null;

    return {
      ...coupon,
      code,
      type,
      value
    };
  }

  function loadCart() {
    try {
      const stored = safeStorageGet(CART_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];

      cart = Array.isArray(parsed)
        ? parsed.map(normalizeCartItem).filter(Boolean)
        : [];
    } catch (error) {
      console.warn("BULKKOT cart load failed:", error);
      cart = [];
    }

    try {
      const storedCoupon = safeStorageGet(COUPON_STORAGE_KEY);
      const parsedCoupon = storedCoupon ? JSON.parse(storedCoupon) : null;
      appliedCoupon = normalizeCoupon(parsedCoupon);
    } catch (error) {
      console.warn("BULKKOT coupon load failed:", error);
      appliedCoupon = null;
    }
  }

  function saveCart() {
    safeStorageSet(CART_STORAGE_KEY, JSON.stringify(cart));

    if (appliedCoupon) {
      safeStorageSet(
        COUPON_STORAGE_KEY,
        JSON.stringify(appliedCoupon)
      );
    } else {
      safeStorageRemove(COUPON_STORAGE_KEY);
    }

    updateCartUI();
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatINR(val) {
    return `₹${Number(val || 0).toLocaleString("en-IN")}`;
  }

  function getSafeImageUrl(value) {
    const url = String(value || "").trim();

    if (!url) return FALLBACK_IMAGE;

    if (/^(javascript:|data:|vbscript:)/i.test(url)) {
      return FALLBACK_IMAGE;
    }

    return url;
  }

  function getCartSubtotal() {
    return cart.reduce((acc, item) => {
      const quantity = normalizeQuantity(item.quantity, 0);
      const price = Number(item.price || 0);

      return acc + (price * quantity);
    }, 0);
  }

  function getCartDiscount() {
    const subtotal = getCartSubtotal();
    const coupon = normalizeCoupon(appliedCoupon);

    if (!coupon || subtotal <= 0) return 0;

    let discount = 0;

    if (coupon.type === "percent") {
      discount = Math.round(
        (subtotal * coupon.value) / 100
      );
    } else if (coupon.type === "fixed") {
      discount = Math.min(
        subtotal,
        coupon.value || 0
      );
    }

    return Math.max(
      0,
      Math.min(
        subtotal,
        Number(discount) || 0
      )
    );
  }

  function getCartTotal() {
    return Math.max(
      0,
      getCartSubtotal() - getCartDiscount()
    );
  }

  /* =========================================================
     CART STATE
     ========================================================= */

  function addItem(product) {
    if (!product || product.id == null || product.size == null) {
      return;
    }

    const id = String(product.id).trim();
    const size = String(product.size).trim().toUpperCase();

    if (!id || !size) return;

    const incomingQuantity = Math.max(
      1,
      normalizeQuantity(product.quantity, 1)
    );

    const existing = cart.find(
      item =>
        String(item.id) === id &&
        String(item.size).toUpperCase() === size
    );

    if (existing) {
      existing.quantity = Math.min(
        MAX_QTY,
        normalizeQuantity(existing.quantity, 0) +
        incomingQuantity
      );
    } else {
      const item = normalizeCartItem({
        id,
        name: product.name,
        price: product.price,
        size,
        image: product.image,
        quantity: incomingQuantity
      });

      if (!item) return;

      cart.push(item);
    }

    saveCart();
    openCart();
  }

  function removeItem(id, size) {
    const targetId = String(id ?? "");
    const targetSize = String(size ?? "").toUpperCase();

    cart = cart.filter(
      item =>
        !(
          String(item.id) === targetId &&
          String(item.size).toUpperCase() === targetSize
        )
    );

    saveCart();
  }

  function updateQuantity(id, size, delta) {
    const targetId = String(id ?? "");
    const targetSize = String(size ?? "").toUpperCase();
    const change = Number(delta);

    if (!Number.isFinite(change) || change === 0) {
      return;
    }

    const item = cart.find(
      entry =>
        String(entry.id) === targetId &&
        String(entry.size).toUpperCase() === targetSize
    );

    if (!item) return;

    const currentQuantity = normalizeQuantity(
      item.quantity,
      0
    );

    const nextQuantity =
      currentQuantity + Math.trunc(change);

    if (nextQuantity <= 0) {
      removeItem(targetId, targetSize);
      return;
    }

    item.quantity = Math.min(
      MAX_QTY,
      nextQuantity
    );

    saveCart();
  }

  /* =========================================================
     STOCK RECONCILIATION
     ========================================================= */

  async function validateStock() {
    if (!supabaseClient || !cart.length) {
      return { valid: true };
    }

    try {
      const ids = [
        ...new Set(
          cart.map(item => item.id)
        )
      ];

      const { data, error } =
        await supabaseClient
          .from("products")
          .select("id, stock")
          .in("id", ids);

      if (error || !Array.isArray(data)) {
        return { valid: true };
      }

      let changed = false;
      const corrections = [];

      cart.forEach(item => {
        const product = data.find(
          x => String(x.id) === String(item.id)
        );

        const stock = product?.stock;

        const maxStock =
          stock && typeof stock === "object"
            ? Math.max(
                0,
                Number(stock[item.size] || 0)
              )
            : 0;

        const currentQuantity =
          normalizeQuantity(item.quantity, 0);

        if (currentQuantity > maxStock) {
          changed = true;

          item.quantity = maxStock;

          corrections.push({
            id: item.id,
            size: item.size,
            newQty: maxStock
          });
        }
      });

      if (changed) {
        cart = cart.filter(
          item =>
            normalizeQuantity(
              item.quantity,
              0
            ) > 0
        );

        saveCart();

        return {
          valid: false,
          message:
            "Inventory updated. Some items or sizes were adjusted.",
          corrections
        };
      }

      return {
        valid: true
      };
    } catch (error) {
      console.warn(
        "BULKKOT stock validation failed:",
        error
      );

      return {
        valid: true
      };
    }
  }

  /* =========================================================
     CART DRAWER MARKUP SUPPORT
     ========================================================= */

  function getCartDrawer() {
    return (
      document.getElementById("cartDrawer") ||
      document.getElementById("cart-drawer") ||
      document.querySelector("[data-cart-drawer]")
    );
  }

  function getCartOverlay() {
    return (
      document.getElementById("cartOverlay") ||
      document.querySelector("[data-cart-overlay]")
    );
  }

  function ensureCartItemsContainer() {
    let itemsContainer =
      document.getElementById("cartItems") ||
      document.getElementById("cart-content");

    if (itemsContainer) {
      return itemsContainer;
    }

    const drawer = getCartDrawer();

    if (!drawer) {
      return null;
    }

    itemsContainer = document.createElement("div");

    itemsContainer.id = "cart-content";
    itemsContainer.className = "drawer__body";

    drawer.appendChild(itemsContainer);

    return itemsContainer;
  }

  /* =========================================================
     CART UI
     ========================================================= */

  function updateCartUI() {
    const countEls =
      document.querySelectorAll(
        "[data-cart-count]"
      );

    const totalCount = cart.reduce(
      (sum, item) =>
        sum +
        normalizeQuantity(
          item.quantity,
          0
        ),
      0
    );

    countEls.forEach(el => {
      el.textContent = String(totalCount);
      el.hidden = totalCount === 0;
    });

    const itemsContainer =
      ensureCartItemsContainer();

    if (!itemsContainer) {
      return;
    }

    if (!cart.length) {
      itemsContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #888;">
          <strong style="display:block; font-size: 14px; color: #fff; margin-bottom: 8px;">YOUR BAG IS EMPTY</strong>
          <p style="font-size: 12px; margin: 0 0 20px;">No silhouettes added yet.</p>
          <a href="shop.html" class="button button--primary" style="display: inline-flex;">EXPLORE CATALOGUE</a>
        </div>
      `;

      const footer =
        document.getElementById(
          "cartFooter"
        );

      if (footer) {
        footer.hidden = true;
      }

      return;
    }

    const footer =
      document.getElementById(
        "cartFooter"
      );

    if (footer) {
      footer.hidden = false;
    }

    itemsContainer.innerHTML =
      cart.map(item => {
        const safeId =
          escapeHTML(item.id);

        const safeName =
          escapeHTML(item.name);

        const safeSize =
          escapeHTML(item.size);

        const safeImage =
          escapeHTML(
            getSafeImageUrl(
              item.image
            )
          );

        const safeQuantity =
          normalizeQuantity(
            item.quantity,
            1
          );

        const lineTotal =
          Number(item.price || 0) *
          safeQuantity;

        return `
      <div class="cart-item" style="display:flex; gap:14px; padding:16px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${safeImage}" alt="${safeName}" style="width:70px; height:84px; object-fit:cover; border-radius:4px; background:#111;">
        <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <strong style="font-size:11px; color:#fff; display:block; text-transform:uppercase;">${safeName}</strong>
              <span style="font-size:10px; color:#888;">SIZE: ${safeSize}</span>
            </div>
            <span style="font-size:12px; font-weight:800; color:#fff;">${formatINR(lineTotal)}</span>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
            <div style="display:inline-flex; align-items:center; border:1px solid #333; border-radius:3px;">
              <button
                type="button"
                data-cart-action="dec"
                data-id="${safeId}"
                data-size="${safeSize}"
                aria-label="Decrease quantity"
                style="padding:4px 10px; color:#aaa;"
              >−</button>

              <span style="font-size:11px; font-weight:800; min-width:18px; text-align:center; color:#fff;">
                ${safeQuantity}
              </span>

              <button
                type="button"
                data-cart-action="inc"
                data-id="${safeId}"
                data-size="${safeSize}"
                aria-label="Increase quantity"
                style="padding:4px 10px; color:#aaa;"
              >+</button>
            </div>

            <button
              type="button"
              data-cart-action="remove"
              data-id="${safeId}"
              data-size="${safeSize}"
              style="color:#666; font-size:10px; font-weight:700;"
            >REMOVE</button>
          </div>
        </div>
      </div>
    `;
      }).join("");

    const subEl =
      document.getElementById(
        "cartSubtotal"
      );

    const discEl =
      document.getElementById(
        "cartDiscount"
      );

    const totEl =
      document.getElementById(
        "cartTotal"
      );

    const discRow =
      document.getElementById(
        "cartCouponRow"
      );

    if (subEl) {
      subEl.textContent =
        formatINR(
          getCartSubtotal()
        );
    }

    if (totEl) {
      totEl.textContent =
        formatINR(
          getCartTotal()
        );
    }

    if (discEl && discRow) {
      const disc =
        getCartDiscount();

      discRow.hidden =
        disc <= 0;

      discEl.textContent =
        `−${formatINR(disc)}`;
    }
  }

  function renderCart() {
    updateCartUI();
  }

  /* =========================================================
     DRAWER CONTROLS
     ========================================================= */

  function openCart() {
    const drawer =
      getCartDrawer();

    const overlay =
      getCartOverlay();

    if (!drawer && !overlay) {
      return;
    }

    updateCartUI();

    if (drawer) {
      drawer.classList.add(
        "is-open"
      );

      drawer.removeAttribute(
        "hidden"
      );

      drawer.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    if (overlay) {
      overlay.classList.add(
        "is-open"
      );

      overlay.classList.add(
        "is-active"
      );

      overlay.removeAttribute(
        "hidden"
      );

      overlay.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    document.body.classList.add(
      "drawer-open"
    );
  }

  function closeCart() {
    const drawer =
      getCartDrawer();

    const overlay =
      getCartOverlay();

    if (drawer) {
      drawer.classList.remove(
        "is-open"
      );

      drawer.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    if (overlay) {
      overlay.classList.remove(
        "is-open"
      );

      overlay.classList.remove(
        "is-active"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    document.body.classList.remove(
      "drawer-open"
    );
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  document.addEventListener(
    "click",
    event => {
      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (!target) {
        return;
      }

      const openTrigger =
        target.closest(
          "[data-open-cart], .cart-action"
        );

      if (openTrigger) {
        event.preventDefault();
        openCart();
        return;
      }

      const closeTrigger =
        target.closest(
          "[data-close-cart], [data-cart-overlay]"
        );

      if (closeTrigger) {
        event.preventDefault();
        closeCart();
        return;
      }

      const actionBtn =
        target.closest(
          "[data-cart-action]"
        );

      if (!actionBtn) {
        return;
      }

      const {
        id,
        size,
        cartAction
      } = actionBtn.dataset;

      if (cartAction === "inc") {
        updateQuantity(
          id,
          size,
          1
        );
      } else if (
        cartAction === "dec"
      ) {
        updateQuantity(
          id,
          size,
          -1
        );
      } else if (
        cartAction === "remove"
      ) {
        removeItem(
          id,
          size
        );
      }
    }
  );

  window.addEventListener(
    "bulkkot:order-completed",
    () => {
      renderCart();
    }
  );

  window.BULKKOT_CART = {
    addItem,
    removeItem,
    updateQuantity,
    openCart,
    closeCart,
    validateStock,
    getCartSubtotal,
    getCartTotal,
    renderCart
  };

  loadCart();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      updateCartUI,
      { once: true }
    );
  } else {
    updateCartUI();
  }
})();
