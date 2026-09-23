/**
 * BULKKOT (불꽃) — E-COMMERCE CART & CHECKOUT ENGINE
 * Production Hardened / Identity Bound
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

  function loadCart() {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      cart = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }
    try {
      const storedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
      appliedCoupon = storedCoupon ? JSON.parse(storedCoupon) : null;
    } catch {
      appliedCoupon = null;
    }
  }

  function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    if (appliedCoupon) {
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem(COUPON_STORAGE_KEY);
    }
    updateCartUI();
  }

  function formatINR(val) {
    return `₹${Number(val || 0).toLocaleString("en-IN")}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getCartSubtotal() {
    return cart.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);
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
    if (!product || !product.id || !product.size) return;
    const existing = cart.find(i => String(i.id) === String(product.id) && String(i.size) === String(product.size));
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, (existing.quantity || 1) + (product.quantity || 1));
    } else {
      cart.push({
        id: String(product.id),
        name: product.name || "Garment",
        price: Number(product.price || 0),
        size: String(product.size),
        image: product.image || FALLBACK_IMAGE,
        quantity: Math.min(MAX_QTY, Math.max(1, product.quantity || 1))
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
      item.quantity = Math.min(MAX_QTY, item.quantity);
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
        return { valid: false, message: "Inventory updated. Some items or sizes were adjusted.", corrections };
      }
      return { valid: true };
    } catch {
      return { valid: true };
    }
  }

  function getDrawerEl() {
    return document.getElementById("cartDrawer") || document.getElementById("cart-drawer") || document.querySelector("[data-cart-drawer]");
  }

  function ensureDrawerShell() {
    const drawer = getDrawerEl();
    if (!drawer) return null;

    if (drawer.dataset.bkBuilt === "true") {
      return drawer;
    }

    drawer.innerHTML = `
      <div class="cart-drawer__header" style="display:flex; align-items:flex-start; justify-content:space-between; padding:20px; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div>
          <p style="margin:0 0 2px; font-size:10px; letter-spacing:0.12em; color:#888;">BULKKOT</p>
          <h2 style="margin:0; font-size:16px; letter-spacing:0.04em; color:#fff;">YOUR CART</h2>
        </div>
        <button type="button" data-close-cart aria-label="Close cart" style="background:none; border:none; color:#fff; font-size:22px; line-height:1; cursor:pointer; padding:0;">×</button>
      </div>

      <div class="drawer__body" id="cart-content" style="padding:0 20px; overflow-y:auto; flex:1 1 auto;"></div>

      <div id="cartFooter" hidden style="padding:16px 20px 20px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#ccc; margin-bottom:6px;">
          <span>SUBTOTAL</span><span id="cartSubtotal">₹0</span>
        </div>
        <div id="cartCouponRow" hidden style="display:flex; justify-content:space-between; font-size:12px; color:#31c48d; margin-bottom:6px;">
          <span>DISCOUNT</span><span id="cartDiscount">−₹0</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:800; color:#fff; margin-bottom:14px;">
          <span>TOTAL</span><span id="cartTotal">₹0</span>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" id="cartCouponInput" placeholder="COUPON CODE" style="flex:1; min-width:0; background:#111; border:1px solid #333; color:#fff; padding:10px; font-size:11px; text-transform:uppercase; border-radius:3px;">
          <button type="button" id="cartApplyCoupon" style="background:#1a1a1a; border:1px solid #333; color:#fff; padding:0 14px; font-size:11px; font-weight:700; border-radius:3px; cursor:pointer;">APPLY</button>
        </div>
        <div id="cartCouponMessage" style="font-size:11px; margin-bottom:10px; min-height:14px;"></div>

        <button type="button" id="cartCheckoutBtn" class="button button--primary" style="width:100%; display:block; text-align:center; border:none; cursor:pointer;">PROCEED TO CHECKOUT</button>
      </div>

      <div id="cartCheckoutPanel" hidden style="padding:20px; overflow-y:auto; flex:1 1 auto;">
        <h3 style="margin:0 0 4px; font-size:15px; color:#fff;">SHIPPING DETAILS</h3>
        <p style="margin:0 0 16px; font-size:11px; color:#888;">Cash on Delivery only, right now.</p>

        <div id="checkoutMessage" style="font-size:11px; color:#ff7777; margin-bottom:10px; min-height:14px;"></div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <input type="text" id="coFullName" placeholder="FULL NAME" style="background:#111; border:1px solid #333; color:#fff; padding:11px; font-size:12px; border-radius:3px;">
          <input type="tel" id="coPhone" placeholder="PHONE NUMBER" style="background:#111; border:1px solid #333; color:#fff; padding:11px; font-size:12px; border-radius:3px;">
          <textarea id="coAddress" placeholder="ADDRESS (HOUSE NO, STREET, AREA)" rows="2" style="background:#111; border:1px solid #333; color:#fff; padding:11px; font-size:12px; border-radius:3px; resize:vertical; font-family:inherit;"></textarea>
          <div style="display:flex; gap:8px;">
            <input type="text" id="coCity" placeholder="CITY" style="flex:1; min-width:0; background:#111; border:1px solid #333; color:#fff; padding:11px; font-size:12px; border-radius:3px;">
            <input type="text" id="coState" placeholder="STATE" style="flex:1; min-width:0; background:#111; border:1px solid #333; color:#fff; padding:11px; font-size:12px; border-radius:3px;">
          </div>
          <input type="text" id="coPincode" placeholder="PINCODE" style="background:#111; border:1px solid #333; color:#fff; padding:11px; font-size:12px; border-radius:3px;">
        </div>

        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:800; color:#fff; margin:18px 0;">
          <span>TOTAL PAYABLE</span><span id="coTotal">₹0</span>
        </div>

        <button type="button" id="placeOrderBtn" class="button button--primary" style="width:100%; display:block; text-align:center; margin-bottom:10px; border:none; cursor:pointer;">PLACE ORDER (CASH ON DELIVERY)</button>
        <button type="button" id="backToCartBtn" style="width:100%; background:none; border:none; color:#888; font-size:11px; padding:8px; cursor:pointer;">← BACK TO CART</button>
      </div>

      <div id="cartOrderSuccess" hidden style="padding:40px 20px; text-align:center; overflow-y:auto; flex:1 1 auto;">
        <div style="font-size:34px; margin-bottom:10px; color:#31c48d;">✓</div>
        <h3 style="margin:0 0 8px; font-size:16px; color:#fff;">ORDER PLACED!</h3>
        <p style="font-size:12px; color:#aaa; margin:0 0 4px;">Your order number is</p>
        <p id="successOrderNumber" style="font-size:15px; font-weight:800; color:#fff; margin:0 0 20px;"></p>
        <p style="font-size:11px; color:#777; margin:0 0 20px;">Save this number — you can track your order with it any time.</p>
        <button type="button" id="closeAfterOrderBtn" class="button button--primary" style="width:100%;">CONTINUE SHOPPING</button>
      </div>
    `;

    drawer.dataset.bkBuilt = "true";
    drawer.style.display = "flex";
    drawer.style.flexDirection = "column";

    wireDrawerEvents(drawer);
    return drawer;
  }

  function setInlineMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isError ? "#ff7777" : "#31c48d";
  }

  function showCartView(drawer) {
    if (!drawer) return;
    drawer.querySelector("#cart-content").hidden = false;
    drawer.querySelector("#cartFooter").hidden = cart.length === 0;
    drawer.querySelector("#cartCheckoutPanel").hidden = true;
    drawer.querySelector("#cartOrderSuccess").hidden = true;
  }

  function showCheckoutView(drawer) {
    if (!drawer) return;
    drawer.querySelector("#cart-content").hidden = true;
    drawer.querySelector("#cartFooter").hidden = true;
    drawer.querySelector("#cartCheckoutPanel").hidden = false;
    drawer.querySelector("#cartOrderSuccess").hidden = true;
    drawer.querySelector("#coTotal").textContent = formatINR(getCartTotal());
  }

  function showSuccessView(drawer, orderNumber) {
    if (!drawer) return;
    drawer.querySelector("#cart-content").hidden = true;
    drawer.querySelector("#cartFooter").hidden = true;
    drawer.querySelector("#cartCheckoutPanel").hidden = true;
    drawer.querySelector("#cartOrderSuccess").hidden = false;
    drawer.querySelector("#successOrderNumber").textContent = orderNumber;
  }

  function wireDrawerEvents(drawer) {
    const couponInput = drawer.querySelector("#cartCouponInput");
    const applyCouponBtn = drawer.querySelector("#cartApplyCoupon");
    const couponMessage = drawer.querySelector("#cartCouponMessage");
    const checkoutBtn = drawer.querySelector("#cartCheckoutBtn");
    const backBtn = drawer.querySelector("#backToCartBtn");
    const placeOrderBtn = drawer.querySelector("#placeOrderBtn");
    const closeAfterOrderBtn = drawer.querySelector("#closeAfterOrderBtn");

    applyCouponBtn?.addEventListener("click", async () => {
      const code = String(couponInput?.value || "").trim().toUpperCase();

      if (!code) {
        if (appliedCoupon) {
          appliedCoupon = null;
          saveCart();
          setInlineMessage(couponMessage, "Coupon removed.", false);
        }
        return;
      }

      if (!supabaseClient) {
        setInlineMessage(couponMessage, "Store connection unavailable.", true);
        return;
      }

      applyCouponBtn.disabled = true;
      applyCouponBtn.textContent = "...";

      try {
        const { data, error } = await supabaseClient
          .from("coupons")
          .select("*")
          .eq("code", code)
          .maybeSingle();

        if (error || !data || data.active === false) {
          appliedCoupon = null;
          saveCart();
          setInlineMessage(couponMessage, "Invalid or expired coupon code.", true);
          return;
        }

        appliedCoupon = { code, type: data.type, value: Number(data.value || 0) };
        saveCart();
        setInlineMessage(couponMessage, `Coupon "${code}" applied!`, false);
      } catch {
        setInlineMessage(couponMessage, "Could not apply coupon. Try again.", true);
      } finally {
        applyCouponBtn.disabled = false;
        applyCouponBtn.textContent = "APPLY";
      }
    });

    checkoutBtn?.addEventListener("click", async () => {
      if (!cart.length) return;
      checkoutBtn.disabled = true;
      const check = await validateStock();
      checkoutBtn.disabled = false;

      if (!check.valid) {
        updateCartUI();
        const msg = drawer.querySelector("#checkoutMessage");
        if (msg) msg.textContent = check.message || "Some items changed. Please review your cart.";
        return;
      }

      const msg = drawer.querySelector("#checkoutMessage");
      if (msg) msg.textContent = "";
      showCheckoutView(drawer);
    });

    backBtn?.addEventListener("click", () => showCartView(drawer));

    placeOrderBtn?.addEventListener("click", async () => {
      if (isSubmittingOrder) return;

      const fullName = drawer.querySelector("#coFullName")?.value.trim() || "";
      const phone = drawer.querySelector("#coPhone")?.value.trim() || "";
      const address = drawer.querySelector("#coAddress")?.value.trim() || "";
      const city = drawer.querySelector("#coCity")?.value.trim() || "";
      const stateVal = drawer.querySelector("#coState")?.value.trim() || "";
      const pincode = drawer.querySelector("#coPincode")?.value.trim() || "";
      const msg = drawer.querySelector("#checkoutMessage");

      const setError = (text) => { if (msg) msg.textContent = text || ""; };
      setError("");

      if (!fullName || !phone || !address || !city || !stateVal || !pincode) {
        setError("Please fill in all shipping details.");
        return;
      }

      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      if (!/^\d{10}$/.test(cleanPhone)) {
        setError("Please enter a valid 10-digit phone number.");
        return;
      }

      if (!/^\d{6}$/.test(pincode)) {
        setError("Please enter a valid 6-digit pincode.");
        return;
      }

      if (!cart.length) {
        setError("Your cart is empty.");
        return;
      }

      if (!supabaseClient) {
        setError("Store connection unavailable. Please try again.");
        return;
      }

      isSubmittingOrder = true;
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = "PLACING ORDER...";

      try {
        const stockCheck = await validateStock();
        if (!stockCheck.valid) {
          setError(stockCheck.message || "Some items changed. Please review your cart.");
          showCartView(drawer);
          updateCartUI();
          return;
        }

        let userId = null;
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          userId = userData?.user?.id || null;
        } catch { userId = null; }

        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const now = new Date();
        const datePart = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        const orderNumber = `BK-${datePart}-${randomSuffix}`;

        const subtotal = getCartSubtotal();
        const discount = getCartDiscount();
        const total = getCartTotal();

        const { error } = await supabaseClient.from("orders").insert([{
          order_number: orderNumber,
          user_id: userId,
          customer_name: fullName,
          customer_phone: cleanPhone,
          shipping_address: address,
          shipping_city: city,
          shipping_state: stateVal,
          shipping_pincode: pincode,
          items: cart,
          subtotal,
          discount,
          total,
          coupon_code: appliedCoupon?.code || null,
          payment_method: "Cash on Delivery",
          order_status: "PLACED"
        }]);

        if (error) throw error;

        cart = [];
        appliedCoupon = null;
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(COUPON_STORAGE_KEY);

        showSuccessView(drawer, orderNumber);
        updateCartUI();

        window.dispatchEvent(new CustomEvent("bulkkot:order-completed", { detail: { orderNumber } }));
      } catch (error) {
        setError(error?.message || "Something went wrong placing your order. Please try again.");
      } finally {
        isSubmittingOrder = false;
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "PLACE ORDER (CASH ON DELIVERY)";
      }
    });

    closeAfterOrderBtn?.addEventListener("click", () => {
      closeCart();
      showCartView(drawer);
    });
  }

  function updateCartUI() {
    const drawer = ensureDrawerShell();
    if (!drawer) return;

    const countEls = document.querySelectorAll("[data-cart-count]");
    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    countEls.forEach(el => {
      el.textContent = String(totalCount);
      el.hidden = totalCount === 0;
    });

    const itemsContainer = drawer.querySelector("#cart-content");
    if (!itemsContainer) return;

    if (!cart.length) {
      itemsContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #888;">
          <strong style="display:block; font-size: 14px; color: #fff; margin-bottom: 8px;">YOUR BAG IS EMPTY</strong>
          <p style="font-size: 12px; margin: 0 0 20px;">No silhouettes added yet.</p>
          <a href="shop.html" class="button button--primary" style="display: inline-flex;" onclick="window.BULKKOT_CART.closeCart()">EXPLORE CATALOGUE</a>
        </div>
      `;
      const footer = drawer.querySelector("#cartFooter");
      if (footer) footer.hidden = true;
      return;
    }

    const footer = drawer.querySelector("#cartFooter");
    if (footer) footer.hidden = false;

    itemsContainer.innerHTML = cart.map(item => {
      const safeId = escapeHTML(item.id);
      const safeName = escapeHTML(item.name);
      const safeSize = escapeHTML(item.size);
      const safeImage = escapeHTML(item.image || FALLBACK_IMAGE);
      const lineTotal = Number(item.price || 0) * (item.quantity || 1);

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
                <button type="button" data-cart-action="dec" data-id="${safeId}" data-size="${safeSize}" aria-label="Decrease quantity" style="padding:4px 10px; color:#aaa; font-weight:800;">−</button>
                <span style="font-size:11px; font-weight:800; min-width:18px; text-align:center; color:#fff;">${item.quantity}</span>
                <button type="button" data-cart-action="inc" data-id="${safeId}" data-size="${safeSize}" aria-label="Increase quantity" style="padding:4px 10px; color:#aaa; font-weight:800;">+</button>
              </div>
              <button type="button" data-cart-action="remove" data-id="${safeId}" data-size="${safeSize}" style="color:#666; font-size:10px; font-weight:700;">REMOVE</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const subEl = drawer.querySelector("#cartSubtotal");
    const discEl = drawer.querySelector("#cartDiscount");
    const totEl = drawer.querySelector("#cartTotal");
    const discRow = drawer.querySelector("#cartCouponRow");
    const couponInputEl = drawer.querySelector("#cartCouponInput");

    if (subEl) subEl.textContent = formatINR(getCartSubtotal());
    if (totEl) totEl.textContent = formatINR(getCartTotal());
    if (discEl && discRow) {
      const disc = getCartDiscount();
      discRow.hidden = disc <= 0;
      discEl.textContent = `−${formatINR(disc)}`;
    }
    if (couponInputEl && appliedCoupon?.code && !couponInputEl.value) {
      couponInputEl.value = appliedCoupon.code;
    }
  }

  function openCart() {
    const drawer = ensureDrawerShell();
    const overlay = document.getElementById("cartOverlay") || document.querySelector("[data-cart-overlay]") || document.querySelector(".drawer-overlay");
    if (!drawer) return;

    showCartView(drawer);
    updateCartUI();

    drawer.classList.add("is-open");
    drawer.removeAttribute("hidden");
    drawer.setAttribute("aria-hidden", "false");

    if (overlay) {
      overlay.classList.add("is-open", "is-active", "is-visible");
      overlay.removeAttribute("hidden");
      overlay.setAttribute("aria-hidden", "false");
    }

    document.body.classList.add("drawer-open");
  }

  function closeCart() {
    const drawer = getDrawerEl();
    const overlay = document.getElementById("cartOverlay") || document.querySelector("[data-cart-overlay]") || document.querySelector(".drawer-overlay");

    if (drawer) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      setTimeout(() => showCartView(drawer), 300);
    }
    if (overlay) {
      overlay.classList.remove("is-open", "is-active", "is-visible");
      overlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("drawer-open");
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

    const closeTrigger = target.closest("[data-close-cart]");
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
    openCart,
    closeCart,
    validateStock,
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
