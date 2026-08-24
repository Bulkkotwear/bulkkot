const ALLOWED_ADMIN = 'bulkkotwear@gmail.com';

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const authStatusBar = document.getElementById('auth-status-bar');
  const loginBtn = document.getElementById('login-btn');

  if (!window.supabaseClient) {
    if (typeof supabase !== 'undefined' && supabase) {
      window.supabaseClient = supabase;
    } else {
      authStatusBar.innerHTML = `<span style="color: red;">Supabase not configured</span>`;
      return;
    }
  }

  // Check Existing Session
  const { data: { session }, error: sessionErr } = await window.supabaseClient.auth.getSession();
  if (session) {
    evaluateSession(session);
  } else {
    authStatusBar.innerHTML = `<span style="color: #8E8E93;">● Unauthenticated</span>`;
  }

  // Handle Login Submit
  document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginBtn.textContent = 'AUTHENTICATING...';
    loginBtn.disabled = true;

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();

    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        alert('Login Error: ' + error.message);
        loginBtn.textContent = 'AUTHENTICATE';
        loginBtn.disabled = false;
      } else {
        evaluateSession(data.session);
      }
    } catch (err) {
      alert('Network/Configuration Error: ' + err.message);
      loginBtn.textContent = 'AUTHENTICATE';
      loginBtn.disabled = false;
    }
  });

  // Handle Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await window.supabaseClient.auth.signOut();
    window.location.reload();
  });

  function evaluateSession(session) {
    if (session && session.user && session.user.email === ALLOWED_ADMIN) {
      loginSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      authStatusBar.innerHTML = `<span style="color: #4CAF50;">● Connected: ${session.user.email}</span>`;
      loadAdminProducts();
    } else if (session) {
      alert('Unauthorized account: ' + session.user.email);
      window.supabaseClient.auth.signOut();
    }
  }

  async function loadAdminProducts() {
    const tbody = document.getElementById('admin-products-table-body');
    const { data: products, error } = await window.supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    tbody.innerHTML = (products && products.length > 0) 
      ? products.map(p => `
          <tr>
            <td>${p.sku || '-'}</td>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td>₹${p.price}</td>
            <td>${p.visibility ? 'Live' : 'Hidden'}</td>
            <td>
              <button onclick="deleteProduct('${p.id}')" style="color: var(--accent-red); font-size: 12px; cursor: pointer;">Delete</button>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No products in catalog yet.</td></tr>`;
  }

  document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('p-name').value;
    const category = document.getElementById('p-category').value;
    const price = parseFloat(document.getElementById('p-price').value);
    const sku = document.getElementById('p-sku').value;
    const file = document.getElementById('p-image-file').files[0];

    let imageUrl = '';
    if (file) {
      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
        .from('product-media')
        .upload(fileName, file);

      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = window.supabaseClient.storage
        .from('product-media')
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    }

    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now();

    const { error } = await window.supabaseClient.from('products').insert([{
      name,
      slug,
      category,
      price,
      sku,
      images: imageUrl ? [imageUrl] : [],
      visibility: true
    }]);

    if (error) {
      alert('Error inserting product: ' + error.message);
    } else {
      alert('Product published successfully.');
      document.getElementById('add-product-form').reset();
      loadAdminProducts();
    }
  });

  window.deleteProduct = async function(id) {
    if (confirm('Delete this item permanently?')) {
      const { error } = await window.supabaseClient.from('products').delete().eq('id', id);
      if (error) alert(error.message);
      else loadAdminProducts();
    }
  };
});
