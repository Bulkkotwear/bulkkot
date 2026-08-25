// BULKKOT Local Cart Management System
const CART_STORAGE_KEY = 'bulkkot_cart';

function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartUI();
}

function addToCart(product, size = 'M') {
  const cart = getCart();
  const existingIndex = cart.findIndex(item => item.id === product.id && item.size === size);

  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: (product.images && product.images[0]) || 'hero-model.png',
      category: product.category,
      size: size,
      qty: 1
    });
  }

  saveCart(cart);
  toggleCartDrawer(true);
}

function updateCartItemQty(id, size, change) {
  let cart = getCart();
  const index = cart.findIndex(item => item.id === id && item.size === size);

  if (index > -1) {
    cart[index].qty += change;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
  }

  saveCart(cart);
}

function updateCartUI() {
  const cart = getCart();
  const countBadge = document.getElementById('cart-count');
  const drawerBody = document.querySelector('.drawer-body');

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  if (countBadge) {
    countBadge.textContent = totalQty;
    countBadge.style.display = totalQty > 0 ? 'inline-block' : 'none';
  }

  if (!drawerBody) return;

  if (cart.length === 0) {
    drawerBody.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
      <p style="color: var(--text-muted); font-size: 13px; margin-top: 12px;">Your shopping bag is empty.</p>
      <span style="color: var(--accent-red); font-size: 11px; font-weight: 700; margin-top: 6px;">DROP 001 RELEASING SOON</span>
    `;
    return;
  }

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  drawerBody.innerHTML = `
    <div class="cart-items-list" style="width: 100%; display: flex; flex-direction: column; gap: 14px;">
      ${cart.map(item => `
        <div style="display: flex; gap: 12px; align-items: center; border-bottom: 1px solid var(--border-dark); padding-bottom: 12px;">
          <img src="${item.image}" alt="${item.name}" style="width: 54px; height: 54px; object-fit: cover; border-radius: 4px; background: #161616;">
          <div style="flex: 1; text-align: left;">
            <div style="font-size: 12px; font-weight: 700;">${item.name}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Size: ${item.size} | ₹${item.price}</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
              <button onclick="updateCartItemQty('${item.id}', '${item.size}', -1)" style="background:#161616; border:1px solid var(--border-dark); color:#FFF; width:22px; height:22px; border-radius:3px;">-</button>
              <span style="font-size: 12px; font-weight: 700;">${item.qty}</span>
              <button onclick="updateCartItemQty('${item.id}', '${item.size}', 1)" style="background:#161616; border:1px solid var(--border-dark); color:#FFF; width:22px; height:22px; border-radius:3px;">+</button>
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 800;">₹${item.price * item.qty}</div>
        </div>
      `).join('')}
    </div>

    <div style="margin-top: 20px; width: 100%; border-top: 1px solid var(--border-dark); padding-top: 16px;">
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; margin-bottom: 14px;">
        <span>SUBTOTAL</span>
        <span>₹${totalPrice}</span>
      </div>
      <button onclick="alert('Checkout will open when DROP 001 goes live!')" style="width: 100%; background: #FFF; color: #000; border: none; padding: 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; border-radius: 3px;">CHECKOUT →</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', updateCartUI);
