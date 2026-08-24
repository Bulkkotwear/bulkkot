document.addEventListener('DOMContentLoaded', async () => {
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

  const productContainer = document.getElementById('products-dynamic-container');
  if (productContainer) {
    const products = await getActiveProducts();
    if (products && products.length > 0) {
      productContainer.innerHTML = `
        <div class="product-grid">
          ${products.map(p => `
            <div class="product-card">
              <img src="${p.images[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'}" alt="${p.name}" class="product-card-img">
              <div style="font-size: 11px; color: var(--accent-red); font-weight: 700;">${p.category}</div>
              <div style="font-size: 15px; font-weight: 700; margin: 4px 0;">${p.name}</div>
              <div style="font-size: 14px; color: var(--text-muted);">₹${p.price}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }
});
