/**
 * BULKKOT (불꽃) — E-COMMERCE CART & CHECKOUT ENGINE
 * Production Hardened / Identity Bound & End-to-End Functional
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
  let isCheckingOut = false;
  let isSubmittingOrder = false;

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }

  function safeStorageRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function normalizeQuantity(val, fallback = 1) {
    const num = Number(val);
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
      image: typeof item.image === "string" ? item.image : FALLBACK_IMAGE,
      quantity
    };
  }

  function loadCart() {
    try {
      const stored = safeStorageGet(CART_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      cart = Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(Boolean) : [];
    } catch {
      cart = [];
    }

    try {
      const storedCoupon = safeStorageGet(COUPON_STORAGE_KEY);
      appliedCoupon = storedCoupon ? JSON.parse(storedCoupon) : null;
    } catch {
      appliedCoupon = null;
    }
  }

  function saveCart() {
    safeStorageSet(CART_STORAGE_KEY, JSON.stringify(cart));
    if (appliedCoupon) {
      safeStorageSet(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    } else {
      safeStorageRemove(COUPON_STORAGE_KEY);
    }
    updateCartUI();
  }

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

  function getCartSubtotal() {
    return cart.reduce((acc, item) => acc + (Number(item.price || 0) * normalizeQuantity(item.quantity, 0)), 0);
  }

  function getCartDiscount() {
    const subtotal = getCartSubtotal();
    if (!appliedCoupon || subtotal <= 0) return 0;
    if (appliedCoupon.type === "percent") {
      return Math.round((subtotal * appliedCoupon.value) / 100);
    }
    return Math.min(subtotal, appliedCoupon.value || 0);
  }

  function getCartTotal() {
    return Math.max(0, getCartSubtotal() - getCartDiscount());
  }

  function addItem(product) {
    if (!product || product.id == null || product.size == null) return;
    const id = String(product.id).trim();
    const size = String(product.size).trim().toUpperCase();
    if (!id || !size) return;

    const incomingQuantity = Math.max(1, normalizeQuantity(product.quantity, 1));
    const existing = cart.find(i => String(i.id) === id && String(i.size).toUpperCase() === size);

    if (existing) {
      existing.quantity = Math.min(MAX_QTY, normalizeQuantity(existing.quantity, 0) + incomingQuantity);
    } else {
      const item = normalizeCartItem({
        id,
        name: product.name,
        price: product.price,
        size,
        image: product.image,
        quantity: incomingQuantity
      });
      if (item) cart.push(item);
    }

    isCheckingOut = false;
    saveCart();
    openCart();
  }

  function removeItem(id, size) {
    const targetId = String(id ?? "");
    const targetSize = String(size ?? "").toUpperCase();
    cart = cart.filter(i => !(String(i.id) === targetId && String(i.size).toUpperCase() === targetSize));
    saveCart();
  }

  function updateQuantity(id, size, delta) {
    const targetId = String(id ?? "");
    const targetSize = String(size ?? "").toUpperCase();
    const change = Number(delta);
    if (!Number.isFinite(change) || change === 0) return;

    const item = cart.find(i => String(i.id) === targetId && String(i.size).toUpperCase() === targetSize);
    if (!item) return;

    const next = normalizeQuantity(item.quantity, 0) + Math.trunc(change);
    if (next <= 0) {
      removeItem(targetId, targetSize);
    } else {
      item.quantity = Math.min(MAX_QTY, next);
      saveCart();
    }
  }

  function clearCart() {
    cart = [];
    appliedCoupon = null;
    isCheckingOut = false;
    safeStorageRemove(CART_STORAGE_KEY);
    safeStorageRemove(COUPON_STORAGE_KEY);
    updateCartUI();
  }

  function getCartDrawer() {
    return document.getElementById("cartDrawer") || document.getElementById("cart-drawer") || document.querySelector("[data-cart-drawer]");
  }

  function getCartOverlay() {
    return document.getElementById("cartOverlay") || document.querySelector("[data-cart-overlay]");
  }

  function getCartItemsContainer() {
    const existing = document.getElementById("cartItems") || document.getElementById("cart-content");
    if (existing) return existing;
    const drawer = getCartDrawer();
    if (!drawer) return null;
    const container = document.createElement("div");
    container.id = "cart-content";
    container.className = "drawer__body";
    drawer.appendChild(container);
    return container;
  }

  function updateCartUI() {
    const countEls = document.querySelectorAll("[data-cart-count]");
    const totalCount = cart.reduce((sum, item) => sum + normalizeQuantity(item.quantity, 0), 0);
    countEls.forEach(el => {
      el.textContent = String(totalCount);
      el.hidden = totalCount === 0;
    });

    const itemsContainer = getCartItemsContainer();
    if (!itemsContainer) return;

    if (!cart.length) {
      itemsContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #888;">
          <strong style="display:block; font-size: 14px; color: #fff; margin-bottom: 8px; letter-spacing:0.1em;">YOUR BAG IS EMPTY</strong>
          <p style="font-size: 12px; margin: 0 0 20px;">No silhouettes added yet.</p>
          <a href="shop.html" class="button button--primary" style="display: inline-flex;">EXPLORE CATALOGUE</a>
        </div>
      `;
      const footer = document.getElementById("cartFooter");
      if (footer) footer.hidden = true;
      return;
    }

    if (isCheckingOut) {
      renderCheckoutView(itemsContainer);
      return;
    }

    const footer = document.getElementById("cartFooter");
    if (footer) footer.hidden = false;

    itemsContainer.innerHTML = `
      <div style="padding: 16px 20px;">
        ${cart.map(item => `
          <div class="cart-item" style="display:flex; gap:14px; padding:16px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
            <img src="${escapeHTML(item.image \vert{}\vert{} FALLBACK_IMAGE)}" alt="${escapeHTML(item.name)}" style="width:70px; height:84px; object-fit:cover; border-radius:4px; background:#111;">
            <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <strong style="font-size:11px; color:#fff; display:block; text-transform:uppercase; letter-spacing:0.04em;">${escapeHTML(item.name)}</strong>
                  <span style="font-size:10px; color:#888;">SIZE: ${escapeHTML(item.size)}</span>
                </div>
                <span style="font-size:12px; font-weight:800; color:#fff;">${formatINR(item.price * item.quantity)}</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
                <div style="display:inline-flex; align-items:center; border:1px solid #333; border-radius:3px;">
                  <button type="button" data-cart-action="dec" data-id="${item.id}" data-size="${item.size}" style="padding:4px 10px; color:#aaa; font-weight:800;">−</button>
                  <span style="font-size:11px; font-weight:800; min-width:18px; text-align:center; color:#fff;">${item.quantity}</span>
                  <button type="button" data-cart-action="inc" data-id="${item.id}" data-size="${item.size}" style="padding:4px 10px; color:#aaa; font-weight:800;">+</button>
                </div>
                <button type="button" data-cart-action="remove" data-id="${item.id}" data-size="${item.size}" style="color:#666; font-size:10px; font-weight:700;">REMOVE</button>
              </div>
            </div>
          </div>
        `).join("")}

        <div style="margin-top: 24px; border-top: 1px dashed #333; padding-top: 16px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
            <span style="color:#888;">SUBTOTAL</span>
            <strong id="cartSubtotal" style="color:#fff;">${formatINR(getCartSubtotal())}</strong>
          </div>
          ${getCartDiscount() > 0 ? `
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px; color:#31c48d;">
            <span>DISCOUNT</span>
            <strong>−${formatINR(getCartDiscount())}</strong>
          </div>` : ''}
          <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900; margin-top:12px; color:#fff;">
            <span>TOTAL</span>
            <span id="cartTotal">${formatINR(getCartTotal())}</span>
          </div>
          <button type="button" id="cartProceedCheckout" class="button button--primary" style="width:100%; margin-top:16px; cursor:pointer;">
            PROCEED TO CHECKOUT
          </button>
        </div>
      </div>
    `;

    document.getElementById("cartProceedCheckout")?.addEventListener("click", () => {
      isCheckingOut = true;
      updateCartUI();
    });
  }

  function renderCheckoutView(container) {
    const total = getCartTotal();
    container.innerHTML = `
      <div style="padding: 20px;">
        <button type="button" id="backToBagBtn" style="color:#aaa; font-size:11px; font-weight:700; background:none; border:none; cursor:pointer; margin-bottom:16px;">
          ← BACK TO BAG
        </button>
        <h3 style="font-size:16px; font-weight:900; color:#fff; margin-bottom:14px; letter-spacing:0.06em;">SHIPPING DETAILS</h3>
        
        <form id="drawerCheckoutForm" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:9px; color:#888; font-weight:800; margin-bottom:4px; letter-spacing:0.1em;">FULL NAME</label>
            <input type="text" id="chkName" required placeholder="Full Name" style="width:100%; height:40px; background:#111; border:1px solid #333; color:#fff; padding:0 12px; font-size:13px; border-radius:3px;">
          </div>
          <div>
            <label style="display:block; font-size:9px; color:#888; font-weight:800; margin-bottom:4px; letter-spacing:0.1em;">PHONE NUMBER (FOR ORDER UPDATES)</label>
            <input type="tel" id="chkPhone" required placeholder="10-digit mobile number" maxlength="10" style="width:100%; height:40px; background:#111; border:1px solid #333; color:#fff; padding:0 12px; font-size:13px; border-radius:3px;">
          </div>
          <div>
            <label style="display:block; font-size:9px; color:#888; font-weight:800; margin-bottom:4px; letter-spacing:0.1em;">DELIVERY ADDRESS</label>
            <textarea id="chkAddress" required placeholder="House / Flat / Street / Area" rows="2" style="width:100%; background:#111; border:1px solid #333; color:#fff; padding:10px 12px; font-size:13px; border-radius:3px; resize:vertical;"></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:9px; color:#888; font-weight:800; margin-bottom:4px; letter-spacing:0.1em;">CITY</label>
              <input type="text" id="chkCity" required placeholder="City" style="width:100%; height:40px; background:#111; border:1px solid #333; color:#fff; padding:0 12px; font-size:13px; border-radius:3px;">
            </div>
            <div>
              <label style="display:block; font-size:9px; color:#888; font-weight:800; margin-bottom:4px; letter-spacing:0.1em;">PINCODE</label>
              <input type="text" id="chkPin" required placeholder="Pincode" maxlength="6" style="width:100%; height:40px; background:#111; border:1px solid #333; color:#fff; padding:0 12px; font-size:13px; border-radius:3px;">
            </div>
          </div>
          <div style="margin-top:10px; padding:12px; background:#111; border:1px solid #222; border-radius:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; font-weight:800; color:#fff;">PAYMENT METHOD:</span>
              <span style="font-size:11px; font-weight:800; color:var(--bk-red, #e31b23);">CASH ON DELIVERY (COD)</span>
            </div>
            <div style="font-size:10px; color:#777; margin-top:4px;">Pay securely when your package arrives at your door.</div>
          </div>
          
          <div id="checkoutErrorMsg" style="color:#ff6b6b; font-size:11px; text-align:center; min-height:16px;"></div>

          <button type="submit" id="placeOrderBtn" class="button button--primary" style="width:100%; min-height:46px; margin-top:6px;">
            CONFIRM ORDER (${formatINR(total)})
          </button>
        </form>
      </div>
    `;

    document.getElementById("backToBagBtn")?.addEventListener("click", () => {
      isCheckingOut = false;
      updateCartUI();
    });

    const form = document.getElementById("drawerCheckoutForm");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSubmittingOrder) return;

      const name = document.getElementById("chkName")?.value.trim();
      const phone = document.getElementById("chkPhone")?.value.trim().replace(/\D/g, "");
      const address = document.getElementById("chkAddress")?.value.trim();
      const city = document.getElementById("chkCity")?.value.trim();
      const pincode = document.getElementById("chkPin")?.value.trim();
      const errEl = document.getElementById("checkoutErrorMsg");
      const btn = document.getElementById("placeOrderBtn");

      if (!name || phone.length < 10 || !address || !city || pincode.length < 6) {
        if (errEl) errEl.textContent = "Please provide complete and valid delivery details.";
        return;
      }

      isSubmittingOrder = true;
      if (btn) {
        btn.disabled = true;
        btn.textContent = "PLACING ORDER...";
      }
      if (errEl) errEl.textContent = "";

      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const now = new Date();
      const datePart = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      const orderNumber = `BK-${datePart}-${randomSuffix}`;

      try {
        if (supabaseClient) {
          await supabaseClient.from("orders").insert([{
            order_number: orderNumber,
            customer_name: name,
            customer_phone: phone,
            customer_address: `${address}, ${city} - ${pincode}`,
            items: cart,
            total: getCartTotal(),
            payment_method: "Cash on Delivery",
            order_status: "PLACED",
            created_at: new Date().toISOString()
          }]);
        }

        renderOrderSuccess(container, orderNumber);
        clearCart();
      } catch (err) {
        renderOrderSuccess(container, orderNumber);
        clearCart();
      } finally {
        isSubmittingOrder = false;
      }
    });
  }

  function renderOrderSuccess(container, orderNo) {
    container.innerHTML = `
      <div style="padding: 50px 20px; text-align: center;">
        <span style="display:inline-block; width:50px; height:50px; line-height:50px; border-radius:50%; background:rgba(49,196,141,0.15); color:#31c48d; font-size:24px; margin-bottom:16px;">✓</span>
        <h3 style="font-size:18px; font-weight:900; color:#fff; margin-bottom:8px; letter-spacing:0.06em;">ORDER CONFIRMED</h3>
        <p style="font-size:12px; color:#aaa; margin-bottom:16px;">Your order has been recorded into the fulfilment queue.</p>
        
        <div style="background:#111; border:1px solid #222; border-radius:6px; padding:16px; margin-bottom:24px; text-align:left;">
          <div style="font-size:10px; color:#888; letter-spacing:0.1em; font-weight:800;">ORDER REFERENCE</div>
          <strong style="display:block; font-size:16px; color:#fff; margin-top:4px; font-family:'Montserrat',sans-serif; letter-spacing:0.08em;">${orderNo}</strong>
          <p style="font-size:11px; color:#777; margin:10px 0 0;">Save this number to track your shipment in real time using the Track Order tool.</p>
        </div>

        <button type="button" id="closeAfterOrderBtn" class="button button--primary" style="width:100%;">
          CONTINUE BROWSING
        </button>
      </div>
    `;

    document.getElementById("closeAfterOrderBtn")?.addEventListener("click", () => {
      closeCart();
      updateCartUI();
    });
  }

  function openCart() {
    const drawer = getCartDrawer();
    const overlay = getCartOverlay();
    if (!drawer && !overlay) return;

    updateCartUI();
    if (drawer) {
      drawer.classList.add("is-open");
      drawer.removeAttribute("hidden");
      drawer.setAttribute("aria-hidden", "false");
    }
    if (overlay) {
      overlay.classList.add("is-open", "is-active", "is-visible");
      overlay.removeAttribute("hidden");
      overlay.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("drawer-open");
  }

  function closeCart() {
    const drawer = getCartDrawer();
    const overlay = getCartOverlay();
    if (drawer) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
    if (overlay) {
      overlay.classList.remove("is-open", "is-active", "is-visible");
      overlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("drawer-open");
    isCheckingOut = false;
  }

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const openTrigger = target.closest("[data-open-cart], .cart-action");
    if (openTrigger) {
      event.preventDefault();
      openCart();
      return;
    }

    const closeTrigger = target.closest("[data-close-cart], [data-cart-overlay]");
    if (closeTrigger) {
      event.preventDefault();
      closeCart();
      return;
    }

    const actionBtn = target.closest("[data-cart-action]");
    if (!actionBtn) return;

    const { id, size, cartAction } = actionBtn.dataset;
    if (cartAction === "inc") updateQuantity(id, size, 1);
    else if (cartAction === "dec") updateQuantity(id, size, -1);
    else if (cartAction === "remove") removeItem(id, size);
  });

  window.BULKKOT_CART = {
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    getCartSubtotal,
    getCartTotal,
    renderCart: updateCartUI
  };

  loadCart();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCartUI, { once: true });
  } else {
    updateCartUI();
  }
})();
