const ALLOWED_ADMIN = 'bulkkotwear@gmail.com';

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const authStatusBar = document.getElementById('auth-status-bar');

  const { data: { session } } = await supabase.auth.getSession();
  evaluateSession(session);

  document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Authentication failed: ' + error.message);
    } else {
      evaluateSession(data.session);
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });

  function evaluateSession(session) {
    if (session && session.user.email === ALLOWED_ADMIN) {
      loginSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      authStatusBar.innerHTML = `<span style="color: #4CAF50;">● Connected: ${session.user.email}</span>`;
      loadAdminProducts();
    } else {
      loginSection.style.display = 'block';
      dashboardSection.style.display = 'none';
      authStatusBar.innerHTML = `<span style="color: var(--accent-red);">● Unauthenticated</span>`;
    }
  }

  async function loadAdminProducts() {
    const tbody = document.getElementById('admin-products-table-body');
    const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${p.sku || '-'}</td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>₹${p.price}</td>
        <td>${p.visibility ? 'Live' : 'Hidden'}</td>
        <td>
          <button onclick="deleteProduct('${p.id}')" style="color: var(--accent-red); font-size: 12px;">Delete</button>
        </td>
      </tr>
    `).join('');
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
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-media')
        .upload(fileName, file);

      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-media')
        .getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    }

    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now();

    const { error } = await supabase.from('products').insert([{
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
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) alert(error.message);
      else loadAdminProducts();
    }
  };
});
