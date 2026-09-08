/**
 * BULKKOT — Cart, Checkout & Order Placement Engine
 * Version: 2.0 (RPC create_order Integration)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bulkkot_cart';
  let cart = [];
  let appliedCoupon = null;

  // Supabase reference
  function getSupabase() {
    return window.supabaseClient || (window.supabase ? window.supabase : null);
  }

  // Formatting helpers
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

  // Load / Save Local Cart
  function loadCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      cart = data ? JSON.parse(data) : [];
    } catch (e) {
      cart = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
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

  // Cart Operations
  function addItem(item) {
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

  function clearCart() {
    cart = [];
    appliedCoupon = null;
    saveCart();
    renderCart();
  }

  // Cart Drawer UI Toggles
  function openCart() {
    const drawer = document.querySelector('[data-cart-drawer]');
    const overlay = document.querySelector('[data-cart-overlay]');
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

  // Calculate Totals
  function getCartSubtotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function calculateDiscount(subtotal) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) return 0;

    if (appliedCoupon.discount_type === 'percentage') {
      return Math.round((subtotal * (appliedCoupon.discount_value / 100)));
    }
    return Math.min(subtotal, appliedCoupon.discount_value);
  }

  // Render Cart & Checkout View
  async function renderCart() {
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
    const total = Math.max(0, subtotal - discount);

    // Fetch user profile for autofill if logged in
    const client = getSupabase();
    let userProfile = null;
    let currentUser = null;

    if (client) {
      const { data: authData } = await client.auth.getUser();
      currentUser = authData?.user;
      if (currentUser) {
        const { data: profile } = await client
          .from('customer_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();
        userProfile = profile;
      }
    }

    const itemsHTML = cart
      .map(
        (item, idx) => `
        <div class="cart-item" style="display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid #222;">
          <img src="${escapeHTML(item.image || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}"
               alt="${escapeHTML(item.name)}" style="width: 72px; height: 72px; object-fit: cover; border-radius: 6px; background: #181818;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #fff;">${escapeHTML(item.name)}</h4>
              <button type="button" data-cart-remove="${idx}" style="background: none; border: none; color: #777; cursor: pointer; font-size: 14px;">×</button>
            </div>
            <p style="margin: 4px 0; font-size: 11px; color: #888;">SIZE: <strong>${escapeHTML(item.size)}</strong></p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
              <div style="display: flex; align-items: center; border: 1px solid #333; border-radius: 4px;">
                <button type="button" data-cart-qty="${idx}" data-qty="${item.quantity - 1}" style="background: none; border: none; color: #fff; padding: 2px 8px; cursor: pointer;">-</button>
                <span style="font-size: 12px; padding: 0 4px;">${item.quantity}</span>
                <button type="button" data-cart-qty="${idx}" data-qty="${item.quantity + 1}" style="background: none; border: none; color: #fff; padding: 2px 8px; cursor: pointer;">+</button>
              </div>
              <strong style="font-size: 13px; color: #fff;">${formatPrice(item.price * item.quantity)}</strong>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div class="cart-items-wrap" style="max-height: 38vh; overflow-y: auto; padding-right: 4px;">
        ${itemsHTML}
      </div>

      <!-- COUPON ROW -->
      <div style="margin: 16px 0 10px; display: flex; gap: 8px;">
        <input type="text" id="cartCouponInput" placeholder="DISCOUNT CODE" value="${appliedCoupon ? escapeHTML(appliedCoupon.code) : ''}"
               style="flex: 1; background: #111; border: 1px solid #333; color: #fff; padding: 8px 12px; font-size: 11px; text-transform: uppercase; border-radius: 4px;"
               ${appliedCoupon ? 'disabled' : ''}>
        <button type="button" id="cartApplyCouponBtn" class="button button--small" style="padding: 8px 14px; font-size: 10px; font-weight: 700; background: #222; color: #fff; border: 1px solid #444; cursor: pointer;">
          ${appliedCoupon ? 'REMOVE' : 'APPLY'}
        </button>
      </div>

      <!-- SUMMARY -->
      <div style="padding: 12px 0; border-top: 1px solid #222; font-size: 12px; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between; color: #888;">
          <span>Subtotal</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        ${
          discount > 0
            ? `
          <div style="display: flex; justify-content: space-between; color: #31c48d;">
            <span>Discount (${escapeHTML(appliedCoupon.code)})</span>
            <span>-${formatPrice(discount)}</span>
          </div>
        `
            : ''
        }
        <div style="display: flex; justify-content: space-between; color: #888;">
          <span>Shipping</span>
          <span style="color: #31c48d; font-weight: 700;">FREE</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #fff; font-size: 15px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #333;">
          <span>Total</span>
          <span>${formatPrice(total)}</span>
        </div>
      </div>

      <!-- CHECKOUT FORM -->
      <form id="storefrontCheckoutForm" novalidate style="margin-top: 10px; border-top: 1px solid #222; padding-top: 14px;">
        <div style="margin-bottom: 12px;">
          <span class="eyebrow" style="font-size: 10px; color: #aaa;">SHIPPING & CONTACT DETAILS</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <input type="text" id="chkName" placeholder="Full Name *" required value="${escapeHTML(userProfile?.full_name || '')}" style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
          <input type="tel" id="chkPhone" placeholder="Phone Number *" required value="${escapeHTML(userProfile?.phone || '')}" style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 8px;">
          <input type="email" id="chkEmail" placeholder="Email Address *" required value="${escapeHTML(currentUser?.email || userProfile?.email || '')}" style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 8px;">
          <input type="text" id="chkAddress" placeholder="Street Address / House No *" required value="${escapeHTML(userProfile?.shipping_address || '')}" style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
          <input type="text" id="chkCity" placeholder="City *" required value="${escapeHTML(userProfile?.shipping_city || '')}" style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
          <input type="text" id="chkState" placeholder="State *" required value="${escapeHTML(userProfile?.shipping_state || '')}" style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
          <input type="text" id="chkPincode" placeholder="Pincode *" required value="${escapeHTML(userProfile?.shipping_pincode || '')}" style="background: #111; border: 1px solid #333; color: #fff; padding: 8px 10px; font-size: 11px; border-radius: 4px;">
        </div>

        <div id="checkoutInlineError" style="color: #ff7777; font-size: 11px; margin-bottom: 10px; display: none;"></div>

        <button type="submit" id="cartSubmitOrderBtn" class="button button--primary" style="width: 100%; padding: 12px; font-weight: 800; font-size: 12px; letter-spacing: 0.08em;">
          PLACE ORDER (CASH ON DELIVERY)
        </button>

        <div style="margin-top: 10px; text-align: center; color: #666; font-size: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>🔒 Encrypted & Secure Checkout</span>
          <span>•</span>
          <span>7-Day Easy Exchange</span>
        </div>
      </form>
    `;

    // Bind item buttons
    container.querySelectorAll('[data-cart-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeItem(Number(btn.dataset.cartRemove)));
    });

    container.querySelectorAll('[data-cart-qty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        updateQuantity(Number(btn.dataset.cartQty), Number(btn.dataset.qty));
      });
    });

    // Bind Coupon
    const couponBtn = container.querySelector('#cartApplyCouponBtn');
    couponBtn?.addEventListener('click', async () => {
      if (appliedCoupon) {
        appliedCoupon = null;
        renderCart();
        return;
      }

      const code = container.querySelector('#cartCouponInput')?.value.trim().toUpperCase();
      if (!code) return;

      const supabase = getSupabase();
      if (!supabase) return;

      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('active', true)
        .maybeSingle();

      if (error || !data) {
        alert('Invalid or inactive coupon code.');
        return;
      }

      appliedCoupon = data;
      renderCart();
    });

    // Bind Order Submission
    const checkoutForm = container.querySelector('#storefrontCheckoutForm');
    checkoutForm?.addEventListener('submit', async (e) => {
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
        errBox.textContent = 'Please fill in all required shipping fields.';
        errBox.style.display = 'block';
        return;
      }

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'PROCESSING ORDER...';

      try {
        const client = getSupabase();
        if (!client) throw new Error('Database client offline');

        const { data: authData } = await client.auth.getUser();
        const userId = authData?.user?.id || null;

        // Map items for RPC signature
        const rpcItems = cart.map((item) => ({
          product_id: item.id,
          size: item.size,
          quantity: item.quantity,
          price: item.price
        }));

        // Call atomic RPC
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

        // Render Success State
        const orderNumber = data.order_number;
        const finalTotal = data.total;

        container.innerHTML = `
          <div style="text-align: center; padding: 40px 16px;">
            <div style="width: 50px; height: 50px; background: rgba(49,196,141,.15); color: #31c48d; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
            <p class="eyebrow" style="color: #31c48d; font-weight: 800;">ORDER PLACED SUCCESSFULLY</p>
            <h2 style="font-size: 22px; margin: 8px 0; color: #fff;">${escapeHTML(orderNumber)}</h2>
            <p style="color: #bbb; font-size: 13px; line-height: 1.6; margin: 12px 0 20px;">
              Thank you, <strong>${escapeHTML(name)}</strong>!<br>
              Total: <strong>${formatPrice(finalTotal)}</strong> (Cash on Delivery).<br>
              We are preparing Drop 001 for shipping.
            </p>
            <div style="background: #141414; border: 1px solid #222; border-radius: 8px; padding: 14px; text-align: left; font-size: 11px; line-height: 1.6; color: #999; margin-bottom: 24px;">
              <strong style="color: #fff; display: block; margin-bottom: 4px;">WHAT HAPPENS NEXT:</strong>
              1. Our dispatch team will verify and pack your order.<br>
              2. Track anytime with your Order Number & Phone.<br>
              3. Pay when the courier arrives at your door.
            </div>
            <button type="button" class="button button--primary" data-close-cart style="width: 100%;">CONTINUE EXPLORING</button>
          </div>
        `;
        container.querySelector('[data-close-cart]')?.addEventListener('click', closeCart);

        // Clear Cart
        cart = [];
        appliedCoupon = null;
        saveCart();

        // Refresh storefront products catalog immediately to reflect deducted stock
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('bulkkot:order-completed'));
        }
      } catch (err) {
        console.error('Order creation error:', err);
        errBox.textContent = err.message || 'Unable to place order. Please try again.';
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'PLACE ORDER (CASH ON DELIVERY)';
      }
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    loadCart();

    const openCartBtns = document.querySelectorAll('[data-open-cart]');
    const closeCartBtns = document.querySelectorAll('[data-close-cart]');
    const overlay = document.querySelector('[data-cart-overlay]');

    openCartBtns.forEach((btn) =>
      btn.addEventListener('click', () => {
        renderCart();
        openCart();
      })
    );

    closeCartBtns.forEach((btn) => btn.addEventListener('click', closeCart));
    overlay?.addEventListener('click', closeCart);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCart();
    });
  });

  // Export API
  window.BULKKOT_CART = {
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    openCart,
    closeCart
  };
})();
