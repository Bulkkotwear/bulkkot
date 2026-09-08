/**
 * BULKKOT — Production Cart & Checkout Engine
 * Version: 3.5 (Resilient Client Binding & Guaranteed State Lock)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bulkkot_cart';
  let cart = [];
  let appliedCoupon = null;
  let storeSettings = { shipping_fee: 0, free_shipping_threshold: 0 };
  let isOrderSuccessState = false;

  function getSupabase() {
    return window.BULKKOT_SUPABASE || window.supabaseClient || null;
  }

  function formatPrice(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  }

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      cart = data ? JSON.parse(data) : [];
      if (!Array.isArray(cart)) cart = [];
    } catch (e) {
      cart = [];
    }
    updateCartBadge();
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart', e);
    }
    updateCartBadge();
  }

  function updateCartBadge() {
    const totalCount = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    const badges = document.querySelectorAll('[data-cart-count]');
    badges.forEach((badge) => {
      badge.textContent = totalCount;
      badge.hidden = totalCount === 0;
    });
  }

  async function fetchSettings() {
    const client = getSupabase();
    if (!client) return;
    try {
      const { data } = await client.from('store_settings').select('*').eq('id', 1).maybeSingle();
      if (data) storeSettings = data;
    } catch (e) {}
  }

  function addItem(item) {
    isOrderSuccessState = false;
    const existingIndex = cart.findIndex(
      (i) => String(i.id) === String(item.id) && i.size === item.size
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += Number(item.quantity || 1);
    } else {
      cart.push({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        size: item.size || 'M',
        image: item.image || '',
        quantity: Number(item.quantity || 1)
      });
    }

    saveCart();
    renderCart();
    openCart();
  }

  function removeItem(index) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  }

  function updateQuantity(index, qty) {
    if (qty <= 0) {
      removeItem(index);
    } else {
      cart[index].quantity = qty;
      saveCart();
      renderCart();
    }
  }

  function openCart() {
    const drawer = document.querySelector('[data-cart-drawer]');
    const overlay = document.querySelector('[data-cart-overlay]');
    if (!isOrderSuccessState) renderCart();
    drawer?.classList.add('is-open');
    drawer?.setAttribute('aria-hidden', 'false');
    overlay?.classList.add('is-active');
    document.body.classList.add('modal-open');
  }

  function closeCart() {
    const drawer = document.querySelector('[data-cart-drawer]');
    const overlay = document.querySelector('[data-cart-overlay]');
    drawer?.classList.remove('is-open');
    drawer?.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('is-active');
    document.body.classList.remove('modal-open');
  }

  function getCartSubtotal() {
    return cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  }

  function calculateDiscount(subtotal) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) return 0;
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.round(subtotal * (Number(appliedCoupon.discount_value || 0) / 100));
    }
    return Math.min(subtotal, Number(appliedCoupon.discount_value || 0));
  }

  function calculateShipping(subtotalAfterDiscount) {
    const baseFee = Number(storeSettings.shipping_fee || 0);
    const threshold = Number(storeSettings.free_shipping_threshold || 0);
    if (baseFee <= 0) return 0;
    if (threshold > 0 && subtotalAfterDiscount >= threshold) return 0;
    return baseFee;
  }

  function renderCart() {
    if (isOrderSuccessState) return;

    const container = document.getElementById('cart-content');
    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty" style="text-align: center; padding: 60px 20px;">
          <p class="eyebrow" style="color: #777;">YOUR BAG IS EMPTY</p>
          <p style="margin: 12px 0 24px; color: #bbb;">Heavyweight essentials are waiting for you.</p>
          <button type="button" class="button button--primary" data-close-cart>START SHOPPING</button>
        </div>
      `;
      container.querySelector('[data-close-cart]')?.addEventListener('click', closeCart);
      return;
    }

    const subtotal = getCartSubtotal();
    const discount = calculateDiscount(subtotal);
    const discountedTotal = Math.max(0, subtotal - discount);
    const shippingFee = calculateShipping(discountedTotal);
    const finalTotal = discountedTotal + shippingFee;

    const itemsHTML = cart.map((item, idx) => `
      <div class="cart-item" style="display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid #222;">
        <img src="${escapeHTML(item.image || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}"
             alt="${escapeHTML(item.name)}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; background: #181818;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #fff;">${escapeHTML(item.name)}</h4>
            <button type="button" data-cart-remove="${idx}" style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px; padding: 0 4px;">×</button>
          </div>
          <p style="margin: 4px 0; font-size: 11px; color: #888;">SIZE: <strong style="color:#fff;">${escapeHTML(item.size)}</strong></p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <div style="display: flex; align-items: center; border: 1px solid #333; border-radius: 4px; background: #0c0c0c;">
              <button type="button" data-cart-qty="${idx}" data-qty="${item.quantity - 1}" style="background: none; border: none; color: #fff; padding: 2px 8px; cursor: pointer;">-</button>
              <span style="font-size: 12px; padding: 0 6px; font-weight: 700;">${item.quantity}</span>
              <button type="button" data-cart-qty="${idx}" data-qty="${item.quantity + 1}" style="background: none; border: none; color: #fff; padding: 2px 8px; cursor: pointer;">+</button>
            </div>
            <strong style="font-size: 13px; color: #fff;">${formatPrice(item.price * item.quantity)}</strong>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="cart-items-wrap" style="max-height: 38vh; overflow-y: auto; padding-right: 4px;">
        ${itemsHTML}
      </div>

      <div style="margin: 14px 0 8px; display: flex; gap: 8px;">
        <input type="text" id="cartCouponInput" placeholder="DISCOUNT CODE" value="${appliedCoupon ? escapeHTML(appliedCoupon.code) : ''}"
               style="flex: 1; background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; text-transform: uppercase; border-radius: 4px;"
               ${appliedCoupon ? 'disabled' : ''}>
        <button type="button" id="cartApplyCouponBtn" class="button button--small" style="padding: 8px 12px; font-size: 10px; font-weight: 700; background: #222; color: #fff; border: 1px solid #444; cursor: pointer;">
          ${appliedCoupon ? 'REMOVE' : 'APPLY'}
        </button>
      </div>

      <div style="padding: 10px 0; border-top: 1px solid #222; font-size: 12px; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between; color: #888;">
          <span>Subtotal</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #31c48d;">
            <span>Discount (${escapeHTML(appliedCoupon.code)})</span>
            <span>-${formatPrice(discount)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; color: #888;">
          <span>Delivery</span>
          <span style="${shippingFee === 0 ? 'color:#31c48d; font-weight:700;' : 'color:#fff;'}">
            ${shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #fff; font-size: 15px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #333;">
          <span>Total</span>
          <span>${formatPrice(finalTotal)}</span>
        </div>
      </div>

      <form id="storefrontCheckoutForm" novalidate style="margin-top: 8px; border-top: 1px solid #222; padding-top: 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
          <span class="eyebrow" style="font-size: 10px; color: #aaa;">SHIPPING DETAILS</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <input type="text" id="chkName" placeholder="Full Name *" required style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
          <input type="tel" id="chkPhone" placeholder="Phone Number *" required style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 8px;">
          <input type="email" id="chkEmail" placeholder="Email Address *" required style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 8px;">
          <input type="text" id="chkAddress" placeholder="House No / Street / Landmark *" required style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
          <input type="text" id="chkCity" placeholder="City *" required style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
          <input type="text" id="chkState" placeholder="State *" required style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
          <input type="text" id="chkPincode" placeholder="Pincode *" required style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
        </div>

        <div id="checkoutInlineError" style="color: #ff7777; font-size: 11px; margin-bottom: 10px; display: none;"></div>

        <button type="submit" id="cartSubmitOrderBtn" class="button button--primary" style="width: 100%; padding: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.08em;">
          PLACE ORDER (CASH ON DELIVERY)
        </button>
      </form>
    `;

    tryAutofillAddress();

    container.querySelectorAll('[data-cart-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeItem(Number(btn.dataset.cartRemove)));
    });

    container.querySelectorAll('[data-cart-qty]').forEach((btn) => {
      btn.addEventListener('click', () => updateQuantity(Number(btn.dataset.cartQty), Number(btn.dataset.qty)));
    });

    // Coupon Apply
    container.querySelector('#cartApplyCouponBtn')?.addEventListener('click', async () => {
      if (appliedCoupon) {
        appliedCoupon = null;
        renderCart();
        return;
      }
      const code = container.querySelector('#cartCouponInput')?.value.trim().toUpperCase();
      if (!code) return;

      const client = getSupabase();
      if (!client) return;

      const { data } = await client.from('coupons').select('*').eq('code', code).eq('active', true).maybeSingle();
      if (!data) {
        alert('Invalid coupon code');
        return;
      }
      appliedCoupon = data;
      renderCart();
    });

    // Order Submission
    const form = container.querySelector('#storefrontCheckoutForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#cartSubmitOrderBtn');
      const errBox = container.querySelector('#checkoutInlineError');

      const name = container.querySelector('#chkName').value.trim();
      const phone = container.querySelector('#chkPhone').value.trim();
      const email = container.querySelector('#chkEmail').value.trim();
      const address = container.querySelector('#chkAddress').value.trim();
      const city = container.querySelector('#chkCity').value.trim();
      const state = container.querySelector('#chkState').value.trim();
      const pincode = container.querySelector('#chkPincode').value.trim();

      if (!name || !phone || !email || !address || !city || !state || !pincode) {
        errBox.textContent = 'Please fill in all shipping fields.';
        errBox.style.display = 'block';
        return;
      }

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'CONFIRMING ORDER...';

      try {
        const client = getSupabase();
        if (!client) throw new Error('Database connection unavailable');

        const { data: authData } = await client.auth.getUser();
        const userId = authData?.user?.id || null;

        const rpcItems = cart.map(i => ({
          product_id: i.id,
          size: i.size,
          quantity: i.quantity,
          price: i.price
        }));

        const { data, error } = await client.rpc('create_order', {
          p_customer_name: name,
          p_customer_email: email,
          p_customer_phone: phone,
          p_shipping_address: address,
          p_shipping_city: city,
          p_shipping_state: state,
          p_shipping_pincode: pincode,
          p_items: rpcItems,
          p_coupon_code: appliedCoupon ? appliedCoupon.code : null,
          p_user_id: userId
        });

        if (error) throw error;

        isOrderSuccessState = true;
        const orderNumber = data.order_number;
        const finalOrderTotal = data.total;

        // Render Confirmation Box
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 16px;">
            <div style="width: 50px; height: 50px; background: rgba(49,196,141,.15); color: #31c48d; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
            <p class="eyebrow" style="color: #31c48d; font-weight: 800;">ORDER PLACED SUCCESSFULLY</p>
            <h2 style="font-size: 22px; margin: 8px 0; color: #fff;">${escapeHTML(orderNumber)}</h2>
            <p style="color: #bbb; font-size: 13px; line-height: 1.6; margin: 12px 0 20px;">
              Thank you, <strong>${escapeHTML(name)}</strong>!<br>
              Total: <strong>${formatPrice(finalOrderTotal)}</strong> (Cash on Delivery).<br>
              Your Drop 001 package is being prepared.
            </p>
            <button type="button" class="button button--primary" data-close-cart style="width: 100%;">CONTINUE EXPLORING</button>
          </div>
        `;

        container.querySelector('[data-close-cart]')?.addEventListener('click', () => {
          isOrderSuccessState = false;
          closeCart();
        });

        // Clear Cart
        cart = [];
        appliedCoupon = null;
        saveCart();

        window.dispatchEvent(new CustomEvent('bulkkot:order-completed'));
      } catch (err) {
        errBox.textContent = err.message || 'Unable to place order.';
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'PLACE ORDER (CASH ON DELIVERY)';
      }
    });
  }

  async function tryAutofillAddress() {
    const client = getSupabase();
    if (!client) return;
    try {
      const { data } = await client.auth.getUser();
      if (!data?.user) return;

      const emailEl = document.getElementById('chkEmail');
      if (emailEl) emailEl.value = data.user.email || '';

      const { data: prof } = await client.from('customer_profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (prof) {
        if (document.getElementById('chkName')) document.getElementById('chkName').value = prof.full_name || '';
        if (document.getElementById('chkPhone')) document.getElementById('chkPhone').value = prof.phone || '';
        if (document.getElementById('chkAddress')) document.getElementById('chkAddress').value = prof.shipping_address || '';
        if (document.getElementById('chkCity')) document.getElementById('chkCity').value = prof.shipping_city || '';
        if (document.getElementById('chkState')) document.getElementById('chkState').value = prof.shipping_state || '';
        if (document.getElementById('chkPincode')) document.getElementById('chkPincode').value = prof.shipping_pincode || '';
      }
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', async () => {
    loadCart();
    await fetchSettings();

    document.querySelectorAll('[data-open-cart]').forEach(btn => btn.addEventListener('click', openCart));
    document.querySelectorAll('[data-close-cart]').forEach(btn => btn.addEventListener('click', closeCart));
    document.querySelector('[data-cart-overlay]')?.addEventListener('click', closeCart);
  });

  window.BULKKOT_CART = {
    addItem,
    removeItem,
    updateQuantity,
    openCart,
    closeCart,
    renderCart
  };
})();
