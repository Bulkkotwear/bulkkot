/**
 * BULKKOT — Luxury Cart Engine
 * Version: 7.2 (No-Refresh Payment Switch, WhatsApp Notification Popup, Fix Order Bug)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bulkkot_cart';
  let cart = [];
  let appliedCoupon = null;
  let storeSettings = { shipping_fee: 0, free_shipping_threshold: 0, support_phone: '919876543210' };
  let currentStep = 'bag'; // 'bag' or 'checkout'
  let selectedPayment = 'cod'; // 'cod' is the currently supported payment method

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";

  function getSupabase() {
    if (window.bulkkotSupabase) return window.bulkkotSupabase;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      window.bulkkotSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.bulkkotSupabase;
    }
    return null;
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
      if (data) storeSettings = Object.assign(storeSettings, data);
    } catch (e) {}
  }

  function addItem(item) {
    loadCart();
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
    currentStep = 'bag';
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
    currentStep = 'bag';
    saveCart();
    renderCart();
  }

  function openCart() {
    const drawer = document.querySelector('[data-cart-drawer]');
    const overlay = document.querySelector('[data-cart-overlay]');
    renderCart();
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
      const rawDiscount = Math.round((subtotal * (Number(appliedCoupon.discount_value || 0) / 100)));
      const maxDiscount = Number(appliedCoupon.max_discount || 0);
      return maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
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

  async function lookupPincode(pincode) {
    const cleanPin = String(pincode || '').trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) return;

    const cityInput = document.getElementById('chkCity');
    const stateInput = document.getElementById('chkState');
    const statusBox = document.getElementById('pincodeStatus');

    if (statusBox) {
      statusBox.textContent = 'Locating area...';
      statusBox.style.color = '#888';
      statusBox.style.display = 'block';
    }

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      const data = await res.json();

      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length) {
        const po = data[0].PostOffice[0];
        const district = po.District || po.Block || po.Circle;
        const state = po.State;

        if (cityInput && !cityInput.value) cityInput.value = district;
        if (stateInput && !stateInput.value) stateInput.value = state;

        if (statusBox) {
          statusBox.textContent = `✓ Serviceable: ${district}, ${state}`;
          statusBox.style.color = '#31c48d';
        }
      } else {
        if (statusBox) {
          statusBox.textContent = 'Please enter valid 6-digit pin';
          statusBox.style.color = '#ff7777';
        }
      }
    } catch (e) {
      if (statusBox) statusBox.style.display = 'none';
    }
  }

  function renderCart() {
    const drawer = document.querySelector('[data-cart-drawer]');
    if (!drawer) return;

    loadCart();

    if (cart.length === 0) {
      drawer.innerHTML = `
        <div class="cart-drawer__header">
          <div><p class="eyebrow" style="color:var(--bk-red); font-size:10px; margin:0;">BULKKOT · 불꽃</p><h2>YOUR CART</h2></div>
          <button type="button" class="drawer-close" data-close-cart aria-label="Close cart">×</button>
        </div>
        <div class="cart-body-wrapper" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:60px 24px;">
          <span style="font-size:32px; color:#333; margin-bottom:12px;">◈</span>
          <h3 style="font-size:16px; font-weight:800; color:#fff; margin:0 0 6px;">YOUR BAG IS EMPTY</h3>
          <p style="font-size:12px; color:#888; line-height:1.6; margin:0 0 24px;">Heavyweight silhouettes constructed with architectural restraint await.</p>
          <button type="button" class="bk-btn-primary" data-close-cart style="max-width:240px;">START SHOPPING</button>
        </div>
      `;
      drawer.querySelectorAll('[data-close-cart]').forEach(b => b.addEventListener('click', closeCart));
      return;
    }

    const subtotal = getCartSubtotal();
    const discount = calculateDiscount(subtotal);
    const discountedTotal = Math.max(0, subtotal - discount);
    const shippingFee = calculateShipping(discountedTotal);
    const finalTotal = discountedTotal + shippingFee;

    if (currentStep === 'bag') {
      const itemsHTML = cart.map((item, idx) => `
        <div class="cart-item-row">
          <img src="${escapeHTML(item.image || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png')}"
               alt="${escapeHTML(item.name)}" class="cart-item-img">
          <div class="cart-item-meta">
            <div>
              <div class="cart-item-title-row">
                <h4>${escapeHTML(item.name)}</h4>
                <button type="button" class="cart-remove-btn" data-cart-remove="${idx}">×</button>
              </div>
              <p class="cart-size-label">SIZE: <strong style="color:#fff;">${escapeHTML(item.size)}</strong></p>
            </div>
            <div class="cart-bottom-row">
              <div class="cart-qty-pill">
                <button type="button" data-cart-qty="${idx}" data-qty="${item.quantity - 1}">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-cart-qty="${idx}" data-qty="${item.quantity + 1}">+</button>
              </div>
              <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
            </div>
          </div>
        </div>
      `).join('');

      drawer.innerHTML = `
        <div class="cart-drawer__header">
          <div><p class="eyebrow" style="color:var(--bk-red); font-size:10px; margin:0;">STEP 01 / 02</p><h2>YOUR BAG (${cart.length})</h2></div>
          <button type="button" class="drawer-close" data-close-cart aria-label="Close cart">×</button>
        </div>

        <div class="cart-body-wrapper">
          <div class="cart-items-wrap">
            ${itemsHTML}
          </div>

          <div style="margin: 20px 0 10px; display: flex; gap: 8px;">
            <input type="text" id="cartCouponInput" class="bk-input" placeholder="DISCOUNT CODE" value="${appliedCoupon ? escapeHTML(appliedCoupon.code) : ''}"
                   style="text-transform: uppercase;" ${appliedCoupon ? 'disabled' : ''}>
            <button type="button" id="cartApplyCouponBtn" class="search-tag-btn" style="padding: 0 16px; min-height: 42px; font-weight: 800;">
              ${appliedCoupon ? 'REMOVE' : 'APPLY'}
            </button>
          </div>
        </div>

        <div class="cart-drawer__footer">
          <div class="cart-breakdown-row">
            <span>SUBTOTAL</span>
            <span style="color:#fff;">${formatPrice(subtotal)}</span>
          </div>
          ${discount > 0 ? `
            <div class="cart-breakdown-row" style="color:#31c48d;">
              <span>DISCOUNT (${escapeHTML(appliedCoupon.code)})</span>
              <span>-${formatPrice(discount)}</span>
            </div>
          ` : ''}
          <div class="cart-breakdown-row">
            <span>DELIVERY</span>
            <span style="${shippingFee === 0 ? 'color:#31c48d; font-weight:800;' : 'color:#fff;'}">
              ${shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}
            </span>
          </div>

          <div class="cart-total-strip">
            <span>ESTIMATED TOTAL</span>
            <strong>${formatPrice(finalTotal)}</strong>
          </div>

          <button type="button" id="proceedToCheckoutBtn" class="bk-btn-primary">
            PROCEED TO CHECKOUT →
          </button>
        </div>
      `;

      drawer.querySelector('#proceedToCheckoutBtn')?.addEventListener('click', () => {
        currentStep = 'checkout';
        renderCart();
      });

    } else {
      drawer.innerHTML = `
        <div class="cart-drawer__header">
          <div><p class="eyebrow" style="color:var(--bk-red); font-size:10px; margin:0;">STEP 02 / 02</p><h2>DISPATCH & PAYMENT</h2></div>
          <button type="button" class="drawer-close" data-close-cart aria-label="Close cart">×</button>
        </div>

        <div class="cart-body-wrapper">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <button type="button" id="backToBagBtn" style="background:none; border:none; color:#888; font-size:11px; font-weight:800; cursor:pointer; padding:0;">
              ← BACK TO BAG
            </button>
            <button type="button" id="cartAuthTrigger" style="background:none; border:none; color:var(--bk-red); font-size:10px; font-weight:800; cursor:pointer; padding:0;">
              SIGN IN FOR AUTOFILL
            </button>
          </div>

          <form id="storefrontCheckoutForm" novalidate>
            <div class="bk-input-group">
              <span>CUSTOMER DETAILS</span>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input type="text" id="chkName" class="bk-input" placeholder="Full Name *" required>
                <input type="tel" id="chkPhone" class="bk-input" placeholder="10-digit Phone *" maxlength="15" required>
              </div>
            </div>

            <div class="bk-input-group">
              <span>EMAIL FOR DISPATCH UPDATES</span>
              <input type="email" id="chkEmail" class="bk-input" placeholder="name@email.com *" required>
            </div>

            <div class="bk-input-group">
              <span>DELIVERY ADDRESS</span>
              <input type="text" id="chkAddress" class="bk-input" placeholder="House No / Street / Landmark *" required style="margin-bottom:8px;">
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <input type="text" id="chkPincode" class="bk-input" placeholder="Pincode *" maxlength="6" inputmode="numeric" required>
                <input type="text" id="chkCity" class="bk-input" placeholder="City *" required>
                <input type="text" id="chkState" class="bk-input" placeholder="State *" required>
              </div>
              <small id="pincodeStatus" style="font-size:10px; font-weight:700; margin-top:4px; display:none;"></small>
            </div>

            <div class="bk-input-group" style="margin-top:16px;">
              <span>SELECT PAYMENT OPTION</span>

              <label class="payment-card-label" style="display:flex; align-items:flex-start; gap:12px; padding:14px; background:#111; border:1px solid ${selectedPayment === 'online' ? 'var(--bk-red)' : 'var(--bk-border)'}; border-radius:6px; margin-bottom:8px; cursor:pointer; transition: border-color 0.2s;">
                <input type="radio" name="payment_mode" value="online" ${selectedPayment === 'online' ? 'checked' : ''} style="margin-top:2px; accent-color:var(--bk-red);">
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:12px; color:#fff;">ONLINE UPI / GPAY / PHONEPE</strong>
                    <span style="font-size:8px; background:rgba(49,196,141,0.15); color:#31c48d; padding:2px 6px; border-radius:4px; font-weight:800;">FAST DISPATCH</span>
                  </div>
                  <small style="font-size:10px; color:#888; display:block; margin-top:4px; line-height:1.4;">
                    Our team will contact you on WhatsApp to collect the payment securely.
                  </small>
                </div>
              </label>

              <label class="payment-card-label" style="display:flex; align-items:flex-start; gap:12px; padding:14px; background:#111; border:1px solid ${selectedPayment === 'cod' ? 'var(--bk-red)' : 'var(--bk-border)'}; border-radius:6px; cursor:pointer; transition: border-color 0.2s;">
                <input type="radio" name="payment_mode" value="cod" ${selectedPayment === 'cod' ? 'checked' : ''} style="margin-top:2px; accent-color:var(--bk-red);">
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:12px; color:#fff;">CASH ON DELIVERY (COD)</strong>
                    <span style="font-size:8px; border:1px solid #333; color:#aaa; padding:2px 6px; border-radius:4px;">VERIFIED</span>
                  </div>
                  <small style="font-size:10px; color:#888; display:block; margin-top:4px;">
                    Pay in cash or UPI when the courier agent delivers the package.
                  </small>
                </div>
              </label>
            </div>

            <div id="checkoutInlineError" style="color: #ff7777; font-size: 11px; margin-top: 10px; display: none;"></div>
          </form>
        </div>

        <div class="cart-drawer__footer">
          <div class="cart-total-strip" style="border:none; padding:0; margin:0 0 12px;">
            <span style="color:#888;">TOTAL PAYABLE</span>
            <strong>${formatPrice(finalTotal)}</strong>
          </div>

          <button type="submit" form="storefrontCheckoutForm" id="cartSubmitOrderBtn" class="bk-btn-primary">
            ${selectedPayment === 'online' ? 'PLACE ORDER (UPI NOTIFICATION)' : 'CONFIRM CASH ON DELIVERY'}
          </button>

          <div style="text-align: center; color: #555; font-size: 10px; margin-top: 10px;">
            🔒 100% Encrypted & Direct Warehouse Fulfilment
          </div>
        </div>
      `;

      drawer.querySelector('#backToBagBtn')?.addEventListener('click', () => {
        currentStep = 'bag';
        renderCart();
      });

      const pinInput = drawer.querySelector('#chkPincode');
      pinInput?.addEventListener('input', (e) => {
        if (e.target.value.length === 6) lookupPincode(e.target.value);
      });

      drawer.querySelectorAll('input[name="payment_mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          selectedPayment = e.target.value;
          drawer.querySelectorAll('.payment-card-label').forEach(lbl => lbl.style.borderColor = 'var(--bk-border)');
          e.target.closest('.payment-card-label').style.borderColor = 'var(--bk-red)';

          const submitBtn = drawer.querySelector('#cartSubmitOrderBtn');
          if (submitBtn) {
            submitBtn.textContent = selectedPayment === 'online' ? 'PLACE ORDER (UPI NOTIFICATION)' : 'CONFIRM CASH ON DELIVERY';
          }
        });
      });

      drawer.querySelector('#cartAuthTrigger')?.addEventListener('click', () => {
        closeCart();
        window.location.href = './signin.html';
      });

      tryAutofillAddress();
      bindCheckoutFormSubmit(finalTotal, shippingFee);
    }

    drawer.querySelectorAll('[data-close-cart]').forEach(b => b.addEventListener('click', closeCart));
    drawer.querySelectorAll('[data-cart-remove]').forEach(btn => btn.addEventListener('click', () => removeItem(Number(btn.dataset.cartRemove))));
    drawer.querySelectorAll('[data-cart-qty]').forEach(btn => btn.addEventListener('click', () => updateQuantity(Number(btn.dataset.cartQty), Number(btn.dataset.qty))));
    
    const couponBtn = drawer.querySelector('#cartApplyCouponBtn');
    couponBtn?.addEventListener('click', async () => {
      if (appliedCoupon) {
        appliedCoupon = null;
        renderCart();
        return;
      }
      const code = drawer.querySelector('#cartCouponInput')?.value.trim().toUpperCase();
      if (!code) return;
      const client = getSupabase();
      if (!client) return;
      const { data, error } = await client.from('coupons').select('*').eq('code', code).eq('active', true).maybeSingle();
      if (error || !data) return alert('Invalid coupon.');
      appliedCoupon = data;
      renderCart();
    });
  }

  function bindCheckoutFormSubmit(finalTotal, shippingFee) {
    const checkoutForm = document.getElementById('storefrontCheckoutForm');
    checkoutForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('cartSubmitOrderBtn');
      const errBox = document.getElementById('checkoutInlineError');

      const name = document.getElementById('chkName')?.value.trim();
      const phone = document.getElementById('chkPhone')?.value.trim();
      const email = document.getElementById('chkEmail')?.value.trim();
      const address = document.getElementById('chkAddress')?.value.trim();
      const city = document.getElementById('chkCity')?.value.trim();
      const state = document.getElementById('chkState')?.value.trim();
      const pincode = document.getElementById('chkPincode')?.value.trim();

      if (!name || !phone || !email || !address || !city || !state || !pincode) {
        errBox.textContent = 'Please fill in all shipping fields.';
        errBox.style.display = 'block';
        return;
      }

      errBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'CONFIRMING ORDER WITH WAREHOUSE...';

      try {
        const client = getSupabase();
        if (!client) throw new Error('Database connection unavailable.');

        const rpcItems = cart.map((item) => ({ id: item.id, size: item.size, quantity: item.quantity }));
        const customerPayload = {
          customer_name: name, customer_email: email, customer_phone: phone,
          shipping_address: address, shipping_city: city, shipping_state: state,
          shipping_pincode: pincode, payment_method: selectedPayment,
          coupon_code: appliedCoupon?.code || null
        };

        const { data, error } = await client.rpc('create_order', {
          p_items: rpcItems, p_customer: customerPayload
        });

        if (error) throw error;

        const orderNumber = data.order_number;
        const paymentMode = data.payment_method || selectedPayment;

        const drawer = document.querySelector('[data-cart-drawer]');
        drawer.innerHTML = `
          <div class="cart-drawer__header">
            <div><p class="eyebrow" style="color:#31c48d; font-size:10px; margin:0;">SUCCESSFULLY LOGGED</p><h2>ORDER CONFIRMED</h2></div>
            <button type="button" class="drawer-close" data-close-cart aria-label="Close cart">×</button>
          </div>
          <div class="cart-body-wrapper" style="text-align: center; padding: 40px 24px;">
            <div style="width: 52px; height: 52px; background: rgba(49,196,141,.12); color: #31c48d; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 16px; font-size: 24px;">✓</div>
            <p class="eyebrow" style="color: #31c48d; font-weight: 900; margin-bottom:6px;">DISPATCH QUEUE CONFIRMED</p>
            <h2 style="font-size: 22px; margin: 0 0 8px; color: #fff; letter-spacing:0.05em;">${escapeHTML(orderNumber)}</h2>
            <p style="color: #aaa; font-size: 13px; line-height: 1.6; margin: 0 0 20px;">
              Thank you, <strong>${escapeHTML(name)}</strong>.<br>
              Order Total: <strong>${formatPrice(finalTotal)}</strong> (${paymentMode.toUpperCase()}).
            </p>

            ${paymentMode === 'online' ? `
              <div style="background:#161616; border:1px solid #333; border-radius:8px; padding:18px; text-align:center; margin-bottom:20px;">
                <p class="eyebrow" style="color:var(--bk-red); font-size:10px; margin:0 0 6px;">NEXT STEP</p>
                <strong style="color:#fff; font-size:13px; display:block; margin-bottom:8px;">OUR TEAM WILL CONTACT YOU SHORTLY</strong>
                <p style="font-size:11px; color:#888; margin:0; line-height:1.5;">You will receive a WhatsApp message from our official support team with the UPI QR Code to securely complete your payment.</p>
              </div>
            ` : `
              <div style="background: #111; border: 1px solid var(--bk-border); border-radius: 6px; padding: 14px; text-align: left; font-size: 11px; line-height: 1.7; color: #888; margin-bottom: 24px;">
                <strong style="color: #fff; display: block; margin-bottom: 4px;">DISPATCH PROTOCOL:</strong>
                • Order assigned to warehouse fulfillment queue.<br>
                • Real-time updates active via Track Order in header.<br>
                • Cash on Delivery payment upon courier arrival.
              </div>
            `}

            <button type="button" class="bk-btn-primary" data-close-cart style="width: 100%;">CONTINUE EXPLORING</button>
          </div>
        `;
        drawer.querySelectorAll('[data-close-cart]').forEach(b => b.addEventListener('click', closeCart));

        cart = [];
        appliedCoupon = null;
        currentStep = 'bag';
        saveCart();

        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('bulkkot:order-completed'));
        }
      } catch (err) {
        console.error('Order error:', err);
        errBox.textContent = err.message || 'Unable to place order. Please try again.';
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = selectedPayment === 'online' ? 'PLACE ORDER (UPI NOTIFICATION)' : 'CONFIRM CASH ON DELIVERY';
      }
    });
  }

  async function tryAutofillAddress() {
    const client = getSupabase();
    if (!client) return;
    try {
      const { data: authData } = await client.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const emailField = document.getElementById('chkEmail');
      if (emailField && !emailField.value) emailField.value = user.email || '';

      const { data: profile } = await client.from('customer_profiles').select('*').eq('id', user.id).maybeSingle();

      if (profile) {
        if (document.getElementById('chkName') && !document.getElementById('chkName').value) document.getElementById('chkName').value = profile.full_name || '';
        if (document.getElementById('chkPhone') && !document.getElementById('chkPhone').value) document.getElementById('chkPhone').value = profile.phone || '';
        if (document.getElementById('chkAddress') && !document.getElementById('chkAddress').value) document.getElementById('chkAddress').value = profile.shipping_address || '';
        if (document.getElementById('chkCity') && !document.getElementById('chkCity').value) document.getElementById('chkCity').value = profile.shipping_city || '';
        if (document.getElementById('chkState') && !document.getElementById('chkState').value) document.getElementById('chkState').value = profile.shipping_state || '';
        if (document.getElementById('chkPincode') && !document.getElementById('chkPincode').value) {
          document.getElementById('chkPincode').value = profile.shipping_pincode || '';
          lookupPincode(profile.shipping_pincode);
        }
      }
    } catch (e) {}
  }

  function init() {
    loadCart();
    fetchSettings();

    document.querySelectorAll('[data-open-cart]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCart();
      })
    );
    document.querySelectorAll('[data-close-cart]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeCart();
      })
    );
    document.querySelector('[data-cart-overlay]')?.addEventListener('click', closeCart);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BULKKOT_CART = {
    addItem, removeItem, updateQuantity, clearCart, openCart, closeCart, renderCart
  };
})();
