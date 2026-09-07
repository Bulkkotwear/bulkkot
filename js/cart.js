/**
 * BULKKOT — Production Cart & Checkout Controller
 * Version: 2.1
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const STORAGE_KEY = "bulkkot_cart";
  let cart = [];

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

  function getQuantity(item) {
    return Math.max(1, Number(item.quantity || 1));
  }

  function getSubtotal() {
    return cart.reduce((total, item) => total + Number(item.price || 0) * getQuantity(item), 0);
  }

  function normalizeCartItem(item) {
    return {
      id: String(item.id),
      name: String(item.name || ""),
      price: Number(item.price || 0),
      size: String(item.size || "M").toUpperCase(),
      image: String(item.image || ""),
      quantity: Math.max(1, Number(item.quantity || 1))
    };
  }

  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      cart = Array.isArray(saved) ? saved.map(normalizeCartItem) : [];
    } catch (error) {
      console.warn("BULKKOT cart recovery failed:", error);
      cart = [];
    }
    saveCart(false);
    updateUI();
  }

  function saveCart(update = true) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    if (update) updateUI();
  }

  function clearCart() {
    cart = [];
    saveCart();
  }

  function updateUI() {
    const totalQty = cart.reduce((sum, item) => sum + getQuantity(item), 0);
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = totalQty;
      el.hidden = totalQty === 0;
    });
    renderCartDrawer();
  }

  function renderCartDrawer() {
    const container = document.getElementById("cart-content");
    if (!container) return;

    if (!cart.length) {
      container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #888;">
          <p style="margin-bottom: 16px;">YOUR BAG IS EMPTY</p>
          <button type="button" class="button button--outline" data-close-cart style="font-size: 11px;">CONTINUE SHOPPING</button>
        </div>
      `;
      bindDynamicCartEvents();
      return;
    }

    const subtotal = getSubtotal();
    const itemsHTML = cart.map((item, index) => {
      const quantity = getQuantity(item);
      return `
        <article class="cart-item" data-cart-index="${index}">
          <img class="cart-item__image" src="${escapeHTML(item.image || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}" alt="${escapeHTML(item.name)}" loading="lazy">
          <div class="cart-item__content">
            <div class="cart-item__top">
              <strong class="cart-item__name">${escapeHTML(item.name)}</strong>
              <span class="cart-item__price">${formatPrice(item.price * quantity)}</span>
            </div>
            <p class="cart-item__meta">SIZE: ${escapeHTML(item.size)}</p>
            <div class="cart-item__controls">
              <button type="button" class="cart-qty-btn" data-cart-minus="${index}">−</button>
              <span class="cart-item__quantity">${quantity}</span>
              <button type="button" class="cart-qty-btn" data-cart-plus="${index}">+</button>
              <button type="button" class="cart-remove-btn" data-cart-remove="${index}">REMOVE</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    container.innerHTML = `
      <div class="cart-items" style="padding: 10px 20px; overflow-y: auto; max-height: calc(100vh - 250px);">${itemsHTML}</div>
      <div style="padding: 20px; border-top: 1px solid #222; background: #070707;">
        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; margin-bottom: 14px;">
          <span>SUBTOTAL</span>
          <strong>${formatPrice(subtotal)}</strong>
        </div>
        <button type="button" id="cart-checkout-trigger" class="button button--primary cart-checkout-btn">
          CHECKOUT · ${formatPrice(subtotal)}
        </button>
      </div>
    `;

    bindDynamicCartEvents();
  }

  function bindDynamicCartEvents() {
    const container = document.getElementById("cart-content");
    if (!container) return;

    container.querySelectorAll("[data-cart-minus]").forEach((button) => {
      button.addEventListener("click", () => changeQty(Number(button.dataset.cartMinus), -1));
    });

    container.querySelectorAll("[data-cart-plus]").forEach((button) => {
      button.addEventListener("click", () => changeQty(Number(button.dataset.cartPlus), 1));
    });

    container.querySelectorAll("[data-cart-remove]").forEach((button) => {
      button.addEventListener("click", () => removeItem(Number(button.dataset.cartRemove)));
    });

    document.getElementById("cart-checkout-trigger")?.addEventListener("click", openCheckoutModal);
    container.querySelectorAll("[data-close-cart]").forEach((button) => {
      button.addEventListener("click", closeCart);
    });
  }

  function addItem(item) {
    if (!item || !item.id || !item.size) return;
    const normalized = normalizeCartItem(item);
    const existing = cart.find(
      (cartItem) => String(cartItem.id) === String(normalized.id) && String(cartItem.size) === String(normalized.size)
    );

    if (existing) {
      existing.quantity += normalized.quantity;
    } else {
      cart.push(normalized);
    }

    saveCart();
    openCart();
  }

  function removeItem(index) {
    if (!cart[index]) return;
    cart.splice(index, 1);
    saveCart();
  }

  function changeQty(index, delta) {
    const item = cart[index];
    if (!item) return;
    item.quantity = getQuantity(item) + Number(delta || 0);
    if (item.quantity <= 0) cart.splice(index, 1);
    saveCart();
  }

  function createCheckoutModal() {
    let modal = document.getElementById("checkout-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "checkout-modal";
    modal.className = "content-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="content-modal__panel checkout-panel">
        <button type="button" class="drawer-close" id="close-checkout-btn" aria-label="Close checkout">×</button>
        <p class="eyebrow">BULKKOT · CHECKOUT</p>
        <h2>SHIPPING DETAILS</h2>
        <form id="checkout-order-form" class="checkout-form" novalidate>
          <div class="checkout-field">
            <label for="order-name">FULL NAME</label>
            <input type="text" id="order-name" required>
          </div>
          <div class="checkout-grid">
            <div class="checkout-field">
              <label for="order-email">EMAIL ADDRESS</label>
              <input type="email" id="order-email" required>
            </div>
            <div class="checkout-field">
              <label for="order-phone">PHONE NUMBER</label>
              <input type="tel" id="order-phone" maxlength="10" required>
            </div>
          </div>
          <div class="checkout-field">
            <label for="order-address">DELIVERY ADDRESS</label>
            <textarea id="order-address" rows="2" required></textarea>
          </div>
          <div class="checkout-grid">
            <div class="checkout-field">
              <label for="order-city">CITY</label>
              <input type="text" id="order-city" required>
            </div>
            <div class="checkout-field">
              <label for="order-state">STATE</label>
              <input type="text" id="order-state" required>
            </div>
          </div>
          <div class="checkout-field">
            <label for="order-pincode">PINCODE</label>
            <input type="text" id="order-pincode" maxlength="6" required>
          </div>
          <div class="checkout-payment">
            <p class="checkout-section-label">PAYMENT METHOD</p>
            <label class="checkout-payment-option">
              <input type="radio" name="payment_method" value="cod" checked>
              <span>CASH ON DELIVERY</span>
            </label>
          </div>
          <div id="checkout-err-msg" class="checkout-error" role="alert" aria-live="polite"></div>
          <button type="submit" id="order-submit-btn" class="button button--primary checkout-submit">PLACE ORDER</button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#close-checkout-btn")?.addEventListener("click", closeCheckoutModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeCheckoutModal();
    });

    modal.querySelector("#checkout-order-form")?.addEventListener("submit", handleOrderSubmit);
    return modal;
  }

  function openCheckoutModal() {
    if (!cart.length) return;
    closeCart();
    const modal = createCheckoutModal();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => document.getElementById("order-name")?.focus(), 50);
  }

  function closeCheckoutModal() {
    const modal = document.getElementById("checkout-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".cart-drawer.is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  function getCheckoutData() {
    return {
      customer_name: document.getElementById("order-name")?.value.trim() || "",
      customer_email: document.getElementById("order-email")?.value.trim().toLowerCase() || "",
      customer_phone: document.getElementById("order-phone")?.value.replace(/\D/g, "") || "",
      shipping_address: document.getElementById("order-address")?.value.trim() || "",
      shipping_city: document.getElementById("order-city")?.value.trim() || "",
      shipping_state: document.getElementById("order-state")?.value.trim() || "",
      shipping_pincode: document.getElementById("order-pincode")?.value.replace(/\D/g, "") || "",
      payment_method: document.querySelector('input[name="payment_method"]:checked')?.value || "cod"
    };
  }

  function validateCheckout(data) {
    if (!data.customer_name) return "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customer_email)) return "Please enter a valid email address.";
    if (!/^\d{10}$/.test(data.customer_phone)) return "Please enter a valid 10-digit phone number.";
    if (data.shipping_address.length < 8) return "Please enter your complete delivery address.";
    if (!data.shipping_city) return "Please enter your city.";
    if (!data.shipping_state) return "Please enter your state.";
    if (!/^\d{6}$/.test(data.shipping_pincode)) return "Please enter a valid 6-digit pincode.";
    if (!cart.length) return "Your cart is empty.";
    return null;
  }

  async function handleOrderSubmit(event) {
    event.preventDefault();
    const button = document.getElementById("order-submit-btn");
    const errorElement = document.getElementById("checkout-err-msg");
    if (!button || !errorElement) return;

    errorElement.textContent = "";
    const checkoutData = getCheckoutData();
    const validationError = validateCheckout(checkoutData);

    if (validationError) {
      errorElement.textContent = validationError;
      return;
    }

    button.disabled = true;
    button.textContent = "VERIFYING ORDER...";

    try {
      if (!supabase) throw new Error("Store connection unavailable.");

      const cartPayload = cart.map((item) => ({
        product_id: item.id,
        size: item.size,
        quantity: getQuantity(item)
      }));

      const { data, error } = await supabase.rpc("create_order", {
        p_customer_name: checkoutData.customer_name,
        p_customer_email: checkoutData.customer_email,
        p_customer_phone: checkoutData.customer_phone,
        p_shipping_address: checkoutData.shipping_address,
        p_shipping_city: checkoutData.shipping_city,
        p_shipping_state: checkoutData.shipping_state,
        p_shipping_pincode: checkoutData.shipping_pincode,
        p_payment_method: checkoutData.payment_method,
        p_items: cartPayload
      });

      if (error) throw error;

      const orderNumber = data?.order_number || data?.[0]?.order_number || "";
      clearCart();
      showOrderSuccess(orderNumber);
    } catch (error) {
      console.error("BULKKOT order error:", error);
      let message = "We could not place your order. Please try again.";
      const raw = String(error?.message || "").toLowerCase();
      if (raw.includes("stock")) {
        message = "Selected item is out of stock in requested quantity.";
      } else if (raw.includes("unavailable")) {
        message = "Selected product is currently unavailable.";
      }
      errorElement.textContent = message;
      button.disabled = false;
      button.textContent = "PLACE ORDER";
    }
  }

  function showOrderSuccess(orderNumber) {
    const modal = document.getElementById("checkout-modal");
    if (!modal) return;
    const panel = modal.querySelector(".content-modal__panel");
    if (!panel) return;

    panel.innerHTML = `
      <button type="button" class="drawer-close" id="close-success-btn" aria-label="Close">×</button>
      <div class="order-success">
        <p class="eyebrow">BULKKOT · ORDER CONFIRMED</p>
        <h2>THANK YOU.</h2>
        ${orderNumber ? `<p class="order-success__number">ORDER #${escapeHTML(orderNumber)}</p>` : ""}
        <p>Your order has been successfully placed. We will verify the details via phone/WhatsApp prior to dispatch.</p>
        <button type="button" class="button button--primary" id="success-back-btn">BACK TO SHOP</button>
      </div>
    `;

    document.getElementById("close-success-btn")?.addEventListener("click", closeCheckoutModal);
    document.getElementById("success-back-btn")?.addEventListener("click", () => {
      closeCheckoutModal();
      window.location.hash = "shop";
    });
  }

  function openCart() {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.querySelector("[data-cart-overlay]");
    drawer?.classList.add("is-open");
    drawer?.setAttribute("aria-hidden", "false");
    overlay?.classList.add("is-open");
    document.body.classList.add("modal-open");
  }

  function closeCart() {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.querySelector("[data-cart-overlay]");
    drawer?.classList.remove("is-open");
    drawer?.setAttribute("aria-hidden", "true");
    overlay?.classList.remove("is-open");
    if (!document.querySelector(".content-modal.is-open")) {
      document.body.classList.remove("modal-open");
    }
  }

  window.BULKKOT_CART = {
    addItem,
    removeItem,
    changeQty,
    openCart,
    closeCart,
    clearCart,
    getItems: () => [...cart],
    getSubtotal: () => getSubtotal()
  };

  document.addEventListener("DOMContentLoaded", () => {
    loadCart();
    document.querySelectorAll("[data-open-cart]").forEach((el) => el.addEventListener("click", openCart));
    document.querySelectorAll("[data-close-cart]").forEach((el) => el.addEventListener("click", closeCart));
    document.querySelector("[data-cart-overlay]")?.addEventListener("click", closeCart);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const checkout = document.getElementById("checkout-modal");
      if (checkout?.classList.contains("is-open")) {
        closeCheckoutModal();
        return;
      }
      closeCart();
    });
  });
})();
