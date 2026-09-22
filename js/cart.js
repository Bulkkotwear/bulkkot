/**
 * BULKKOT (불꽃) — E-COMMERCE CART & CHECKOUT ENGINE
 * Production Hardened / Identity Bound & Validated
 */
(() => {
  "use strict";

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";
  const CART_KEY = "bulk_kot_cart_v2";
  const COUPON_KEY = "bulk_kot_coupon_v2";

  const supabaseClient = window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  let cart = [];
  let appliedCoupon = null;

  function loadCart() {
    try {
      cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      cart = [];
    }
    try {
      appliedCoupon = JSON.parse(localStorage.getItem(COUPON_KEY)) || null;
    } catch {
      appliedCoupon = null;
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    if (appliedCoupon) {
      localStorage.setItem(COUPON_KEY, JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem(COUPON_KEY);
    }
    updateUI();
  }

  function formatINR(val) {
    return `₹${Number(val || 0).toLocaleString("en-IN")}`;
  }

  function getSubtotal() {
    return cart.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);
  }

  function getDiscount() {
    const subtotal = getSubtotal();
    if (!appliedCoupon || subtotal <= 0) return 0;
    if (appliedCoupon.type === "percent") {
      return Math.round((subtotal * appliedCoupon.value) / 100);
    }
    return Math.min(subtotal, appliedCoupon.value || 0);
  }

  function getTotal() {
    return Math.max(0, getSubtotal() - getDiscount());
  }

  function addItem(product) {
    if (!product || !product.id || !product.size) return;
    const existing = cart.find(i => String(i.id) === String(product.id) && String(i.size) === String(product.size));
    if (existing) {
      existing.quantity = Math.min(99, (existing.quantity || 1) + (product.quantity || 1));
    } else {
      cart.push({
        id: String(product.id),
        name: product.name || "Garment",
        price: Number(product.price || 0),
        size: String(product.size),
        image: product.image || "https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png",
        quantity: Math.min(99, Math.max(1, product.quantity || 1))
      });
    }
    saveCart();
    openCart();
  }

  function removeItem(id, size) {
    cart = cart.filter(i => !(String(i.id) === String(id) && String(i.size) === String(size)));
    saveCart();
  }

  function updateQuantity(id, size, delta) {
    const item = cart.find(i => String(i.id) === String(id) && String(i.size) === String(size));
    if (!item) return;
    item.quantity = (item.quantity || 1) + delta;
    if (item.quantity <= 0) {
      removeItem(id, size);
    } else {
      item.quantity = Math.min(99, item.quantity);
      saveCart();
    }
  }

  async function validateStock() {
    if (!supabaseClient || !cart.length) return { valid: true };
    try {
      const ids = [...new Set(cart.map(i => i.id))];
      const { data, error } = await supabaseClient.from("products").select("id, stock").in("id", ids);
      if (error || !data) return { valid: true };

      let changed = false;
      const corrections = [];

      cart.forEach(item => {
        const p = data.find(x => String(x.id) === String(item.id));
        const maxStock = p && p.stock && typeof p.stock === "object" ? Number(p.stock[item.size] || 0) : 0;
        if (item.quantity > maxStock) {
          changed = true;
          item.quantity = maxStock;
          corrections.push({ id: item.id, size: item.size, newQty: maxStock });
        }
      });

      if (changed) {
        cart = cart.filter(i => i.quantity > 0);
        saveCart();
        return { valid: false, message: "Inventory updated. Some items were adjusted.", corrections };
      }
      return { valid: true };
    } catch {
      return { valid: true };
    }
  }

  function updateUI() {
    const counts = document.querySelectorAll("[data-cart-count]");
    const totalQty = cart.reduce((sum, i) => sum + (i.quantity || 0), 0);
    counts.forEach(el => {
      el.textContent = totalQty;
      el.hidden = totalQty === 0;
    });

    const container = document.getElementById("cart-content") || document.getElementById("cartItems");
    if (!container) return;

    if (!cart.length) {
      container.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #888;">
          <strong style="display:block; font-size: 14px; color: #fff; margin-bottom: 8px;">YOUR BAG IS EMPTY</strong>
          <p style="font-size: 12px; margin: 0 0 20px;">No silhouettes added yet.</p>
          <a href="shop.html" class="button button--primary" style="display: inline-flex;">EXPLORE CATALOGUE</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="padding: 16px 20px;">
        ${cart.map(item => `
          <div class="cart-item-row" style="display:flex; gap:14px; padding:14px 0; border-bottom:1px solid #1a1a1a;">
            <img src="${item.image}" alt="${item.name}" style="width:68px; height:82px; object-fit:cover; border-radius:4px; background:#141414;">
            <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <strong style="font-size:11px; color:#fff; display:block; text-transform:uppercase;">${item.name}</strong>
                  <span style="font-size:10px; color:#888;">SIZE: ${item.size}</span>
                </div>
                <span style="font-size:12px; font-weight:800; color:#fff;">${formatINR(item.price * item.quantity)}</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
                <div style="display:inline-flex; align-items:center; border:1px solid #333; border-radius:3px;">
                  <button type="button" data-action="dec" data-id="${item.id}" data-size="${item.size}" style="padding:4px 10px; color:#aaa; font-weight:800;">−</button>
                  <span style="font-size:11px; font-weight:800; min-width:18px; text-align:center; color:#fff;">${item.quantity}</span>
                  <button type="button" data-action="inc" data-id="${item.id}" data-size="${item.size}" style="padding:4px 10px; color:#aaa; font-weight:800;">+</button>
                </div>
                <button type="button" data-action="remove" data-id="${item.id}" data-size="${item.size}" style="color:#666; font-size:10px; font-weight:700;">REMOVE</button>
              </div>
            </div>
          </div>
        `).join("")}
        <div style="margin-top: 24px; border-top: 1px dashed #333; padding-top: 16px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
            <span style="color:#888;">SUBTOTAL</span>
            <strong style="color:#fff;">${formatINR(getSubtotal())}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900; margin-top:12px; color:#fff;">
            <span>TOTAL</span>
            <span>${formatINR(getTotal())}</span>
          </div>
          <a href="shop.html" class="button button--primary" style="width:100%; margin-top:16px; text-align:center;">CHECKOUT</a>
        </div>
      </div>
    `;
  }

  function openCart() {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (drawer) {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
    }
    if (overlay) {
      overlay.classList.add("is-open", "is-visible");
      overlay.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("drawer-open");
  }

  function closeCart() {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (drawer) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
    if (overlay) {
      overlay.classList.remove("is-open", "is-visible");
      overlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("drawer-open");
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-cart], .cart-action")) {
      e.preventDefault();
      openCart();
    }
    if (e.target.closest("[data-close-cart], [data-cart-overlay]")) {
      e.preventDefault();
      closeCart();
    }

    const btn = e.target.closest("[data-action]");
    if (btn) {
      const { id, size, action } = btn.dataset;
      if (action === "inc") updateQuantity(id, size, 1);
      if (action === "dec") updateQuantity(id, size, -1);
      if (action === "remove") removeItem(id, size);
    }
  });

  window.BULKKOT_CART = {
    addItem,
    removeItem,
    updateQuantity,
    openCart,
    closeCart,
    validateStock,
    renderCart: updateUI
  };

  loadCart();
  document.addEventListener("DOMContentLoaded", updateUI);
})();
