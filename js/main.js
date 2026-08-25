let currentProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Waitlist Form Handler
  const waitlistForm = document.getElementById('newsletter-form');
  const statusBox = document.getElementById('waitlist-status');

  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('waitlist-email');
      const email = emailInput.value.trim();

      statusBox.textContent = 'Registering your access...';
      statusBox.style.color = '#8E8E93';

      const result = await joinWaitlist(email);

      if (result.success) {
        statusBox.textContent = 'Welcome to the waitlist. We will notify you when DROP 001 goes live.';
        statusBox.style.color = '#FFFFFF';
        emailInput.value = '';
      } else {
        statusBox.textContent = result.error && result.error.includes('duplicate') 
          ? 'You are already registered on the waitlist.' 
          : 'Unable to register at this moment. Please try again.';
        statusBox.style.color = '#E60000';
      }
    });
  }

  await loadProductsCategory(null);
});

// Category Filter
window.filterCatalog = async function(category) {
  const heading = document.getElementById('recent-heading');
  if (heading) {
    heading.textContent = category ? `${category} COLLECTION` : 'RECENT PRODUCTS';
  }
  await loadProductsCategory(category);
  
  const container = document.getElementById('products-dynamic-container');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

async function loadProductsCategory(category) {
  const productContainer = document.getElementById('products-dynamic-container');
  if (!productContainer) return;

  currentProducts = await getActiveProducts(category);

  if (currentProducts && currentProducts.length > 0) {
    productContainer.className = '';
    productContainer.innerHTML = `
      <div class="product-grid">
        ${currentProducts.map((p, idx) => `
          <div class="product-card" onclick="openProductQuickView(${idx})" style="cursor: pointer;">
            <img src="${(p.images && p.images[0]) || 'hero-model.png'}" alt="${p.name}" class="product-card-img">
            <div style="font-size: 10px; color: var(--accent-red); font-weight: 700; letter-spacing: 0.05em;">${p.category}</div>
            <div style="font-size: 13px; font-weight: 700; margin: 4px 0;">${p.name}</div>
            <div style="font-size: 12px; color: var(--text-muted);">₹${p.price}</div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    productContainer.className = 'coming-soon-box';
    productContainer.innerHTML = `
      <div class="box-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>
      </div>
      <h3>${category ? `${category} DROPPING SOON` : 'DROP 001 COMING SOON'}</h3>
      <p>Stay tuned for our first collection.</p>
    `;
  }
}

// Product Quick View Popup
let selectedProduct = null;
let selectedSize = 'M';

window.openProductQuickView = function(idx) {
  selectedProduct = currentProducts[idx];
  if (!selectedProduct) return;

  selectedSize = 'M';
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  document.getElementById('modal-p-img').src = (selectedProduct.images && selectedProduct.images[0]) || 'hero-model.png';
  document.getElementById('modal-p-name').textContent = selectedProduct.name;
  document.getElementById('modal-p-cat').textContent = selectedProduct.category;
  document.getElementById('modal-p-price').textContent = `₹${selectedProduct.price}`;
  document.getElementById('modal-p-desc').textContent = selectedProduct.description || 'Korean-inspired heavyweight premium street garment.';

  renderSizeSelectors();
  modal.style.display = 'flex';
};

function renderSizeSelectors() {
  const sizes = ['S', 'M', 'L', 'XL'];
  const container = document.getElementById('size-options');
  if (!container) return;

  container.innerHTML = sizes.map(s => `
    <button type="button" onclick="selectProductSize('${s}')" style="background: ${selectedSize === s ? '#FFF' : '#141414'}; color: ${selectedSize === s ? '#000' : '#FFF'}; border: 1px solid var(--border-dark); padding: 8px 14px; font-weight: 700; font-size: 11px; border-radius: 3px;">${s}</button>
  `).join('');
}

window.selectProductSize = function(s) {
  selectedSize = s;
  renderSizeSelectors();
};

window.closeProductModal = function() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.style.display = 'none';
};

window.addProductToBag = function() {
  if (selectedProduct) {
    addToCart(selectedProduct, selectedSize);
    closeProductModal();
  }
};
