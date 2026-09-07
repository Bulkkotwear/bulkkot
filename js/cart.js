/**
 * BULKKOT — Complete Cart & Checkout Controller
 */
(function () {
  'use strict';

  const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP";
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  const STORAGE_KEY = 'bulkkot_cart';
  let cart = [];

  function loadCart() {
    try {
      cart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      cart = [];
    }
    updateUI();
  }

  function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateUI();
  }

  function formatPrice(num) {
    return '₹' + Number(num || 0).toLocaleString('en-IN');
  }

  function updateUI() {
    const counts = document.querySelectorAll('[data-cart-count]');
    const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    counts.forEach(el => {
      el.textContent = totalQty;
      el.hidden = totalQty === 0;
    });

    renderCartDrawer();
  }

  function renderCartDrawer() {
    const container = document.getElementById('cart-content');
    if (!container) return;

    if (!cart.length) {
      container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #888;">
          <p style="margin-bottom: 16px;">YOUR BAG IS EMPTY</p>
          <button type="button" class="button button--outline" data-close-cart style="font-size: 11px;">CONTINUE SHOPPING</button>
        </div>
      `;
      return;
    }

    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

    const itemsHTML = cart.map((item, index) => `
      <div style="display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid #1a1a1a;">
        <img src="${item.image || 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png'}" style="width: 70px; height: 70px; object-fit: cover;">
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between;">
            <strong style="font-size: 13px; text-transform: uppercase;">${item.name}</strong>
            <span style="font-size: 13px;">${formatPrice(item.price * item.quantity)}</span>
          </div>
          <p style="font-size: 11px; color: #888; margin: 4px 0 8px;">SIZE: ${item.size}</p>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button type="button" style="background:none; border:1px solid #333; color:#fff; width:22px; height:22px; cursor:pointer;" onclick="window.BULKKOT_CART.changeQty(${index}, -1)">-</button>
            <span style="font-size: 12px;">${item.quantity}</span>
            <button type="button" style="background:none; border:1px solid #333; color:#fff; width:22px; height:22px; cursor:pointer;" onclick="window.BULKKOT_CART.changeQty(${index}, 1)">+</button>
            <button type="button" style="background:none; border:none; color:#e50914; font-size: 11px; margin-left: auto; cursor:pointer;" onclick="window.BULKKOT_CART.removeItem(${index})">REMOVE</button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="padding: 10px 20px; overflow-y: auto; max-height: calc(100vh - 250px);">
        ${itemsHTML}
      </div>
      <div style="padding: 20px; border-top: 1px solid #222; background: #070707;">
        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; margin-bottom: 14px;">
          <span>SUBTOTAL</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        <button type="button" id="cart-checkout-trigger" class="button button--primary" style="width: 100%; padding: 14px 0; font-size: 12px; letter-spacing: 0.1em;">
          CHECKOUT (${formatPrice(subtotal)})
        </button>
      </div>
    `;

    const checkoutBtn = document.getElementById('cart-checkout-trigger');
    if (checkoutBtn) {
      checkoutBtn.onclick = openCheckoutModal;
    }
  }

  // Checkout Form Modal
  function openCheckoutModal() {
    closeCart();

    let modal = document.getElementById('checkout-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'checkout-modal';
      modal.className = 'content-modal';
      modal.innerHTML = `
        <div class="content-modal__panel" style="max-width: 480px;">
          <button type="button" class="drawer-close" id="close-checkout-btn">×</button>
          <p class="eyebrow">BULKKOT · CHECKOUT</p>
          <h2 style="font-size: 20px; margin-bottom: 20px;">SHIPPING DETAILS</h2>
          <form id="checkout-order-form" style="display: flex; flex-direction: column; gap: 12px;">
            <input type="text" id="order-name" placeholder="Full Name" required style="padding: 12px; background: #111; border: 1px solid #333; color: #fff;">
            <input type="email" id="order-email" placeholder="Email Address" required style="padding: 12px; background: #111; border: 1px solid #333; color: #fff;">
            <input type="tel" id="order-phone" placeholder="Phone Number (10 digits)" required style="padding: 12px; background: #111; border: 1px solid #333; color: #fff;">
            <textarea id="order-address" placeholder="Full Delivery Address with Pincode" rows="3" required style="padding: 12px; background: #111; border: 1px solid #333; color: #fff; resize: none;"></textarea>
            <div id="checkout-err-msg" style="color: #e50914; font-size: 12px;"></div>
            <button type="submit" id="order-submit-btn" class="button button--primary" style="width: 100%; padding: 14px 0; margin-top: 10px;">
              CONFIRM ORDER (CASH ON DELIVERY)
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('close-checkout-btn').onclick = () => {
        modal.classList.remove('is-open');
        document.body.classList.remove('modal-open');
      };

      document.getElementById('checkout-order-form').onsubmit = handleOrderSubmit;
    }

    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  async function handleOrderSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('order-submit-btn');
    const errMsg = document.getElementById('checkout-err-msg');
    
    if (!cart.length) return;
    btn.disabled = true;
    btn.textContent = 'PLACING ORDER...';
    errMsg.textContent = '';

    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

    const orderData = {
      customer_name: document.getElementById('order-name').value.trim(),
      customer_email: document.getElementById('order-email').value.trim(),
      customer_phone: document.getElementById('order-phone').value.trim(),
      shipping_address: document.getElementById('order-address').value.trim(),
      items: cart,
      total: subtotal,
      status: 'pending'
    };

    try {
      if (!supabase) throw new Error("Database not connected");
      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) throw error;

      cart = [];
      saveCart();

      const modal = document.getElementById('checkout-modal');
      if (modal) {
        modal.querySelector('.content-modal__panel').innerHTML = `
          <p class="eyebrow">ORDER CONFIRMED</p>
          <h2 style="font-size: 24px; color: #31c48d; margin-bottom: 12px;">THANK YOU</h2>
          <p style="font-size: 14px; color: #aaa; line-height: 1.6; margin-bottom: 24px;">Your order has been recorded. Our team will verify via WhatsApp/Call before dispatch.</p>
          <button type="button" class="button button--primary" onclick="location.reload()">BACK TO SHOP</button>
        `;
      }
    } catch (err) {
      errMsg.textContent = err.message || 'Failed to place order. Try again.';
      btn.disabled = false;
      btn.textContent = 'CONFIRM ORDER';
    }
  }

  function openCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.querySelector('[data-cart-overlay]');
    drawer?.classList.add('is-open');
    drawer?.setAttribute('aria-hidden', 'false');
    overlay?.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.querySelector('[data-cart-overlay]');
    drawer?.classList.remove('is-open');
    drawer?.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  window.BULKKOT_CART = {
    addItem(item) {
      const existing = cart.find(i => i.id === item.id && i.size === item.size);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
        cart.push({ ...item, quantity: 1 });
      }
      saveCart();
      openCart();
    },
    removeItem(index) {
      cart.splice(index, 1);
      saveCart();
    },
    changeQty(index, delta) {
      if (!cart[index]) return;
      cart[index].quantity = (cart[index].quantity || 1) + delta;
      if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
      }
      saveCart();
    },
    openCart,
    closeCart
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadCart();

    document.querySelectorAll('[data-open-cart]').forEach(el => el.onclick = openCart);
    document.querySelectorAll('[data-close-cart]').forEach(el => el.onclick = closeCart);
    const overlay = document.querySelector('[data-cart-overlay]');
    if (overlay) overlay.onclick = closeCart;
  });
})();
