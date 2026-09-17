/**
 * BULKKOT (불꽃) — Admin Core Engine
 * Version: 2.1 (Hardened Announcement Bar Controller — Always Renders, Safe Fallbacks, Verified Upsert)
 */

// 1. SUPABASE CLIENT INITIALIZATION
const SUPABASE_URL = "https://pgubjluqgqvrybvehzeh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWJqbHVxZ3F2cnlidmVoemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzg2NjEsImV4cCI6MjA1NTc1NDY2MX0.g9dK_k660u1dM9eMhGvY61fC8w-aMhV19fN3yZ5k7l8";
const BUCKET_NAME = "product-media";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Store
let currentUser = null;
let currentProducts = [];
let currentOrders = [];
let currentWaitlist = [];
let currentSiteContent = [];
let pendingProductImages = [];
let activeContentGroup = "announcement";

// Hardcoded safe defaults — used whenever the DB is empty, offline, or a key is missing.
// This guarantees the Announcement Bar tab ALWAYS renders fully populated.
const ANNOUNCEMENT_DEFAULTS = {
  announcement_1: "DROP 001 — DROPPING SOON",
  announcement_2: "불꽃 DROP 001 — COMING SOON",
  announcement_3: "JOIN THE VIP WAITLIST",
  announcement_bg: "#e31b23",
  announcement_color: "#ffffff",
  announcement_font: "'Inter', sans-serif",
  announcement_speed: "20"
};

// 2. DOM ELEMENTS & ROUTING
const loginScreen = document.getElementById("login-screen");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const viewTitle = document.getElementById("view-title");

// Toast Notification
function showToast(message, isError = false) {
  const toast = document.getElementById("admin-toast");
  toast.textContent = message;
  toast.style.background = isError ? "#e50914" : "#ffffff";
  toast.style.color = isError ? "#ffffff" : "#000000";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3500);
}

// 3. AUTHENTICATION LIFECYCLE
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    loginScreen.style.display = "none";
    adminApp.style.display = "flex";
    document.getElementById("current-user-email").textContent = currentUser.email;
    loadAllAdminData();
  } else {
    loginScreen.style.display = "flex";
    adminApp.style.display = "none";
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.style.display = "none";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const btn = document.getElementById("login-btn");
  btn.textContent = "VERIFYING...";
  btn.disabled = true;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  btn.textContent = "AUTHENTICATE";
  btn.disabled = false;

  if (error) {
    loginError.textContent = error.message || "Invalid administrative credentials.";
    loginError.style.display = "block";
  } else {
    currentUser = data.user;
    loginScreen.style.display = "none";
    adminApp.style.display = "flex";
    document.getElementById("current-user-email").textContent = currentUser.email;
    loadAllAdminData();
    showToast("Session Authenticated.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  adminApp.style.display = "none";
  loginScreen.style.display = "flex";
  showToast("Logged out securely.");
});

// Sidebar Navigation Tabs
document.querySelectorAll(".sidebar-nav .nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(t => t.classList.remove("active"));

    btn.classList.add("active");
    const targetTab = btn.getAttribute("data-tab");
    document.getElementById(`tab-${targetTab}`).classList.add("active");

    viewTitle.textContent = btn.textContent.trim();
  });
});

// Modal Utilities
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
document.querySelectorAll("[data-close-modal]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close-modal")));
});

// 4. LOAD GLOBAL DATA
async function loadAllAdminData() {
  await Promise.all([
    fetchDashboardMetrics(),
    fetchProducts(),
    fetchSiteContent(),
    fetchOrders(),
    fetchWaitlist(),
    fetchMediaLibrary()
  ]);
}

// 5. DASHBOARD METRICS
async function fetchDashboardMetrics() {
  try {
    const { data: orders } = await supabase.from("orders").select("total_amount, status, created_at, id, customer_name, payment_status").order("created_at", { ascending: false });
    if (orders) {
      document.getElementById("stat-total-orders").textContent = orders.length;
      const rev = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      document.getElementById("stat-total-revenue").textContent = `₹${rev.toLocaleString("en-IN")}`;

      const tbody = document.getElementById("dashboard-recent-orders");
      if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No orders placed yet.</td></tr>`;
      } else {
        tbody.innerHTML = orders.slice(0, 5).map(o => `
          <tr>
            <td><strong>#${o.id.toString().slice(0, 8)}</strong></td>
            <td>${escapeHtml(o.customer_name || "Guest")}</td>
            <td>₹${o.total_amount}</td>
            <td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status || 'unpaid'}</span></td>
            <td><span class="badge badge-success">${o.status || 'Processing'}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
          </tr>
        `).join("");
      }
    }

    const { count: prodCount } = await supabase.from("products").select("*", { count: 'exact', head: true }).eq("is_active", true);
    document.getElementById("stat-active-products").textContent = prodCount || 0;

    const { count: waitCount } = await supabase.from("waitlist").select("*", { count: 'exact', head: true });
    document.getElementById("stat-waitlist-count").textContent = waitCount || 0;
  } catch (err) {
    console.error("Metrics failed:", err);
  }
}

// 6. PRODUCTS MANAGER
async function fetchProducts() {
  const tbody = document.getElementById("products-table-body");
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to fetch products: ${error.message}</td></tr>`;
    return;
  }

  currentProducts = data || [];
  renderProductsTable(currentProducts);
}

function renderProductsTable(products) {
  const tbody = document.getElementById("products-table-body");
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No products available. Click "+ Add New Product" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const firstImg = (p.images && p.images[0]) ? p.images[0] : 'https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png';
    const sizes = p.sizes || { S: 0, M: 0, L: 0, XL: 0 };
    const stockSummary = `S:${sizes.S || 0} | M:${sizes.M || 0} | L:${sizes.L || 0} | XL:${sizes.XL || 0}`;

    return `
      <tr>
        <td><img src="${firstImg}" class="thumb-preview" alt="Thumb"></td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td><span class="badge badge-warning">${(p.category || 'TEES').toUpperCase()}</span></td>
        <td>₹${p.price}</td>
        <td><code>${stockSummary}</code></td>
        <td>
          <span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">
            ${p.is_active ? 'ACTIVE' : 'HIDDEN'}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="toggleProductVisibility('${p.id}', ${!p.is_active})">${p.is_active ? 'Hide' : 'Show'}</button>
          <button class="btn btn-primary btn-sm" onclick="deleteProduct('${p.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

document.getElementById("product-search")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = currentProducts.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  renderProductsTable(filtered);
});

const openProductModalBtn = document.getElementById("open-product-modal-btn");
const productForm = document.getElementById("product-form");
const dropZone = document.getElementById("product-drop-zone");
const prodImagesInput = document.getElementById("prod-images-input");
const imageTray = document.getElementById("product-images-preview");

openProductModalBtn.addEventListener("click", () => {
  document.getElementById("product-modal-title").textContent = "Add New Product";
  productForm.reset();
  document.getElementById("prod-id").value = "";
  pendingProductImages = [];
  renderPendingImages();
  openModal("product-modal");
});

dropZone.addEventListener("click", () => prodImagesInput.click());
prodImagesInput.addEventListener("change", (e) => handleImageUploads(e.target.files));

async function handleImageUploads(files) {
  if (!files || files.length === 0) return;

  showToast("Uploading images to Supabase Storage...");
  for (const file of files) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `catalog/${fileName}`;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);

    if (error) {
      showToast(`Upload failed: ${error.message}`, true);
    } else {
      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      pendingProductImages.push(publicUrl);
    }
  }
  renderPendingImages();
  showToast("Uploaded successfully.");
}

function renderPendingImages() {
  imageTray.innerHTML = pendingProductImages.map((url, index) => `
    <div class="preview-thumb-wrap">
      <img src="${url}" alt="Preview">
      <button type="button" class="preview-remove-btn" onclick="removePendingImage(${index})">&times;</button>
    </div>
  `).join("");
}

window.removePendingImage = function(index) {
  pendingProductImages.splice(index, 1);
  renderPendingImages();
};

window.editProduct = function(id) {
  const prod = currentProducts.find(p => p.id === id);
  if (!prod) return;

  document.getElementById("product-modal-title").textContent = "Edit Product";
  document.getElementById("prod-id").value = prod.id;
  document.getElementById("prod-name").value = prod.name;
  document.getElementById("prod-category").value = prod.category;
  document.getElementById("prod-price").value = prod.price;
  document.getElementById("prod-desc").value = prod.description || "";
  document.getElementById("prod-is-active").checked = prod.is_active;

  const sizes = prod.sizes || {};
  document.getElementById("size-s").value = sizes.S || 0;
  document.getElementById("size-m").value = sizes.M || 0;
  document.getElementById("size-l").value = sizes.L || 0;
  document.getElementById("size-xl").value = sizes.XL || 0;

  pendingProductImages = Array.isArray(prod.images) ? [...prod.images] : [];
  renderPendingImages();

  openModal("product-modal");
};

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("prod-id").value;
  const saveBtn = document.getElementById("save-product-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  const payload = {
    name: document.getElementById("prod-name").value.trim(),
    category: document.getElementById("prod-category").value,
    price: Number(document.getElementById("prod-price").value),
    description: document.getElementById("prod-desc").value.trim(),
    is_active: document.getElementById("prod-is-active").checked,
    images: pendingProductImages,
    sizes: {
      S: Number(document.getElementById("size-s").value) || 0,
      M: Number(document.getElementById("size-m").value) || 0,
      L: Number(document.getElementById("size-l").value) || 0,
      XL: Number(document.getElementById("size-xl").value) || 0
    }
  };

  let res;
  if (id) {
    res = await supabase.from("products").update(payload).eq("id", id);
  } else {
    res = await supabase.from("products").insert([payload]);
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Save Product";

  if (res.error) {
    showToast(`Error: ${res.error.message}`, true);
  } else {
    showToast("Product saved successfully.");
    closeModal("product-modal");
    fetchProducts();
    fetchDashboardMetrics();
  }
});

window.toggleProductVisibility = async function(id, status) {
  const { error } = await supabase.from("products").update({ is_active: status }).eq("id", id);
  if (error) showToast(error.message, true);
  else {
    showToast("Visibility updated.");
    fetchProducts();
  }
};

window.deleteProduct = async function(id) {
  if (!confirm("Are you sure you want to delete this product completely?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) showToast(error.message, true);
  else {
    showToast("Product deleted.");
    fetchProducts();
    fetchDashboardMetrics();
  }
};

// 7. SITE CONTENT EDITOR (WITH HARDENED ANNOUNCEMENT BAR CUSTOMIZER)
async function fetchSiteContent() {
  try {
    const { data, error } = await supabase.from("site_content").select("content_key, content_value");
    if (error) {
      console.warn("site_content fetch error — falling back to defaults:", error.message);
      currentSiteContent = [];
    } else {
      currentSiteContent = data || [];
    }
  } catch (err) {
    console.warn("site_content fetch threw — falling back to defaults:", err);
    currentSiteContent = [];
  }

  // ALWAYS render — regardless of DB success/failure/emptiness.
  // getContentValue() below supplies safe fallbacks per-key so the tab is never blank.
  renderContentSubgroup(activeContentGroup);
}

document.querySelectorAll("#content-sections-tabs .subnav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#content-sections-tabs .subnav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeContentGroup = btn.getAttribute("data-content-group");
    renderContentSubgroup(activeContentGroup);
  });
});

function getContentValue(key, fallback = "") {
  const item = currentSiteContent.find(c => (c.content_key || c.key) === key);
  const val = item ? (item.content_value ?? item.value ?? "") : "";
  // Treat empty-string DB values as "not set" and use the fallback instead,
  // so the Announcement Bar tab never renders blank fields.
  return (val === "" || val === null || val === undefined) ? fallback : val;
}

function renderContentSubgroup(groupName) {
  const container = document.getElementById("content-fields-container");

  // DEDICATED CUSTOMIZER FOR ANNOUNCEMENT BAR
  if (groupName === "announcement") {
    const text1 = getContentValue("announcement_1", ANNOUNCEMENT_DEFAULTS.announcement_1);
    const text2 = getContentValue("announcement_2", ANNOUNCEMENT_DEFAULTS.announcement_2);
    const text3 = getContentValue("announcement_3", ANNOUNCEMENT_DEFAULTS.announcement_3);
    const bgColor = getContentValue("announcement_bg", ANNOUNCEMENT_DEFAULTS.announcement_bg);
    const textColor = getContentValue("announcement_color", ANNOUNCEMENT_DEFAULTS.announcement_color);
    const font = getContentValue("announcement_font", ANNOUNCEMENT_DEFAULTS.announcement_font);
    const speed = getContentValue("announcement_speed", ANNOUNCEMENT_DEFAULTS.announcement_speed);

    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 4px; color:#fff;">Announcement Bar Style & Ticker Controls</h4>
        <p class="text-muted" style="font-size:12px;">Customize announcements, background colors, font and speed in real-time. Changes save directly to <code>site_content</code>.</p>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Announcement Text 1</label>
        <input type="text" name="announcement_1" id="ctrl_ann1" value="${escapeHtml(text1)}">
      </div>
      <div class="form-group" style="margin-bottom: 14px;">
        <label>Announcement Text 2 (Hangul / Sub)</label>
        <input type="text" name="announcement_2" id="ctrl_ann2" value="${escapeHtml(text2)}">
      </div>
      <div class="form-group" style="margin-bottom: 14px;">
        <label>Announcement Text 3</label>
        <input type="text" name="announcement_3" id="ctrl_ann3" value="${escapeHtml(text3)}">
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px;">
        <div class="form-group">
          <label>Background Color</label>
          <div class="color-picker-row">
            <input type="color" id="ctrl_ann_bg_pick" value="${escapeHtml(bgColor)}">
            <input type="text" name="announcement_bg" id="ctrl_ann_bg" value="${escapeHtml(bgColor)}">
          </div>
        </div>
        <div class="form-group">
          <label>Text Color</label>
          <div class="color-picker-row">
            <input type="color" id="ctrl_ann_color_pick" value="${escapeHtml(textColor)}">
            <input type="text" name="announcement_color" id="ctrl_ann_color" value="${escapeHtml(textColor)}">
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px;">
        <div class="form-group">
          <label>Font Family</label>
          <select name="announcement_font" id="ctrl_ann_font">
            <option value="'Inter', sans-serif" ${font.includes("Inter") ? "selected" : ""}>Inter (Minimalist Modern)</option>
            <option value="'Montserrat', sans-serif" ${font.includes("Montserrat") ? "selected" : ""}>Montserrat (Streetwear Bold)</option>
            <option value="'Noto Sans KR', sans-serif" ${font.includes("Noto Sans KR") ? "selected" : ""}>Noto Sans KR (Korean Vibe)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Ticker Speed (Seconds)</label>
          <input type="number" name="announcement_speed" id="ctrl_ann_speed" value="${escapeHtml(String(speed))}" min="6" max="60">
        </div>
      </div>

      <div style="margin-top: 24px;">
        <label style="font-size:12px; color:#aaa; font-weight:700;">Live Interactive Preview</label>
        <div class="ann-preview-container" id="ann_live_preview" style="background:${escapeHtml(bgColor)}; color:${escapeHtml(textColor)}; font-family:${font};">
          <span id="ann_preview_text">${escapeHtml(text1)} &nbsp;•&nbsp; ${escapeHtml(text2)} &nbsp;•&nbsp; ${escapeHtml(text3)}</span>
        </div>
      </div>
    `;

    // Live preview event listeners
    const previewBox = document.getElementById("ann_live_preview");
    const previewText = document.getElementById("ann_preview_text");

    function refreshPreview() {
      const b = document.getElementById("ctrl_ann_bg").value || ANNOUNCEMENT_DEFAULTS.announcement_bg;
      const c = document.getElementById("ctrl_ann_color").value || ANNOUNCEMENT_DEFAULTS.announcement_color;
      const f = document.getElementById("ctrl_ann_font").value || ANNOUNCEMENT_DEFAULTS.announcement_font;
      const t1 = document.getElementById("ctrl_ann1").value;
      const t2 = document.getElementById("ctrl_ann2").value;
      const t3 = document.getElementById("ctrl_ann3").value;

      previewBox.style.backgroundColor = b;
      previewBox.style.color = c;
      previewBox.style.fontFamily = f;
      previewText.innerHTML = `${escapeHtml(t1)} &nbsp;•&nbsp; ${escapeHtml(t2)} &nbsp;•&nbsp; ${escapeHtml(t3)}`;
    }

    ["ctrl_ann1", "ctrl_ann2", "ctrl_ann3", "ctrl_ann_bg", "ctrl_ann_color", "ctrl_ann_font", "ctrl_ann_speed"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", refreshPreview);
    });

    // Sync color picker <-> hex text field (both directions)
    document.getElementById("ctrl_ann_bg_pick")?.addEventListener("input", (e) => {
      document.getElementById("ctrl_ann_bg").value = e.target.value;
      refreshPreview();
    });
    document.getElementById("ctrl_ann_bg")?.addEventListener("input", (e) => {
      if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(e.target.value)) {
        document.getElementById("ctrl_ann_bg_pick").value = e.target.value;
      }
    });

    document.getElementById("ctrl_ann_color_pick")?.addEventListener("input", (e) => {
      document.getElementById("ctrl_ann_color").value = e.target.value;
      refreshPreview();
    });
    document.getElementById("ctrl_ann_color")?.addEventListener("input", (e) => {
      if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(e.target.value)) {
        document.getElementById("ctrl_ann_color_pick").value = e.target.value;
      }
    });

    return;
  }

  // OTHER GENERAL CMS GROUPS
  const filtered = currentSiteContent.filter(item => {
    const k = item.content_key || item.key;
    if (!k) return false;
    return k.toLowerCase().startsWith(groupName.toLowerCase());
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <p class="text-muted">No editable keys matching "<code>${escapeHtml(groupName)}</code>" in <code>site_content</code> table.</p>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const k = item.content_key || item.key;
    const v = item.content_value || item.value || "";
    const isImage = k.includes("img") || k.includes("image") || v.startsWith("http");
    const isLong = v.length > 80;

    return `
      <div class="form-group" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <label style="font-family: monospace; font-size: 13px; color: #fff;">${escapeHtml(k)}</label>
          <small class="text-muted">${escapeHtml(groupName)}</small>
        </div>
        ${
          isImage ? `
            <div style="display:flex; gap: 12px; align-items:center;">
              <img src="${escapeHtml(v)}" style="width: 60px; height: 60px; object-fit: cover; background: #000; border: 1px solid var(--border-color);" id="preview-${escapeHtml(k)}">
              <input type="text" name="${escapeHtml(k)}" value="${escapeHtml(v)}" style="flex:1;" oninput="document.getElementById('preview-${escapeHtml(k)}').src = this.value">
              <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                Upload
                <input type="file" accept="image/*" style="display:none;" onchange="uploadSingleContentImage(this.files[0], '${escapeHtml(k)}')">
              </label>
            </div>
          ` : isLong ? `
            <textarea name="${escapeHtml(k)}" rows="3">${escapeHtml(v)}</textarea>
          ` : `
            <input type="text" name="${escapeHtml(k)}" value="${escapeHtml(v)}">
          `
        }
      </div>
    `;
  }).join("");
}

window.uploadSingleContentImage = async function(file, key) {
  if (!file) return;
  showToast("Uploading replacement asset...");
  const fileExt = file.name.split(".").pop();
  const filePath = `site-assets/${Date.now()}-${key}.${fileExt}`;

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
  if (error) {
    showToast(error.message, true);
  } else {
    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    const input = document.querySelector(`input[name="${key}"]`);
    if (input) {
      input.value = publicUrl;
      const preview = document.getElementById(`preview-${key}`);
      if (preview) preview.src = publicUrl;
    }
    showToast("Asset uploaded and URL assigned.");
  }
};

document.getElementById("site-content-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  // If we're on the Announcement tab, explicitly build the 7-key payload
  // (guarantees all keys are present even if a field was left untouched/empty).
  let updates = [];
  const saveBtn = document.getElementById("save-content-btn");

  if (activeContentGroup === "announcement") {
    const payload = {
      announcement_1: document.getElementById("ctrl_ann1")?.value.trim() || ANNOUNCEMENT_DEFAULTS.announcement_1,
      announcement_2: document.getElementById("ctrl_ann2")?.value.trim() || ANNOUNCEMENT_DEFAULTS.announcement_2,
      announcement_3: document.getElementById("ctrl_ann3")?.value.trim() || ANNOUNCEMENT_DEFAULTS.announcement_3,
      announcement_bg: document.getElementById("ctrl_ann_bg")?.value.trim() || ANNOUNCEMENT_DEFAULTS.announcement_bg,
      announcement_color: document.getElementById("ctrl_ann_color")?.value.trim() || ANNOUNCEMENT_DEFAULTS.announcement_color,
      announcement_font: document.getElementById("ctrl_ann_font")?.value || ANNOUNCEMENT_DEFAULTS.announcement_font,
      announcement_speed: String(document.getElementById("ctrl_ann_speed")?.value || ANNOUNCEMENT_DEFAULTS.announcement_speed)
    };

    updates = Object.entries(payload).map(([content_key, content_value]) =>
      supabase.from("site_content").upsert(
        { content_key, content_value, content_type: "text", updated_at: new Date().toISOString() },
        { onConflict: "content_key" }
      )
    );
  } else {
    const formData = new FormData(e.target);
    for (const [key, value] of formData.entries()) {
      updates.push(
        supabase.from("site_content").upsert(
          { content_key: key, content_value: value, content_type: "text", updated_at: new Date().toISOString() },
          { onConflict: "content_key" }
        )
      );
    }
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "SAVING...";
  showToast("Syncing with live website...");

  try {
    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);
    if (failed) throw failed.error;

    await fetchSiteContent();
    showToast("All changes synced live to database!");
  } catch (err) {
    showToast(`Save failed: ${err.message || "Unknown error"}`, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "SAVE ALL CHANGES LIVE";
  }
});

// 8. ORDERS MODULE
async function fetchOrders() {
  const tbody = document.getElementById("orders-table-body");
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
    return;
  }

  currentOrders = data || [];
  if (currentOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentOrders.map(o => `
    <tr>
      <td><strong>#${o.id.toString().slice(0, 8)}</strong></td>
      <td>${escapeHtml(o.customer_name || 'Guest User')}</td>
      <td><small>${escapeHtml(o.customer_email || 'N/A')}<br>${o.customer_phone || ''}</small></td>
      <td>₹${o.total_amount}</td>
      <td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status || 'unpaid'}</span></td>
      <td>
        <select onchange="updateFulfillmentStatus('${o.id}', this.value)" style="padding: 4px 8px; font-size: 11px;">
          <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
          <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewOrderDetails('${o.id}')">View Details</button>
      </td>
    </tr>
  `).join("");
}

window.updateFulfillmentStatus = async function(id, newStatus) {
  const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id);
  if (error) showToast(error.message, true);
  else showToast(`Order updated to ${newStatus}`);
};

window.viewOrderDetails = async function(id) {
  const order = currentOrders.find(o => o.id === id);
  if (!order) return;

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", id);

  document.getElementById("order-modal-title").textContent = `Order #${order.id.toString().slice(0, 8)}`;
  const body = document.getElementById("order-modal-body");

  body.innerHTML = `
    <div style="margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
      <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || 'N/A')}</p>
      <p><strong>Email:</strong> ${escapeHtml(order.customer_email || 'N/A')}</p>
      <p><strong>Phone:</strong> ${escapeHtml(order.customer_phone || 'N/A')}</p>
      <p><strong>Shipping Address:</strong><br>${escapeHtml(order.shipping_address || 'No address provided')}</p>
    </div>
    <h4>Ordered Items</h4>
    <div style="margin-top: 10px;">
      ${(items && items.length > 0) ? items.map(i => `
        <div style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <span>${escapeHtml(i.product_name || 'Item')} (Size: ${i.size || 'OS'}) x ${i.quantity}</span>
          <strong>₹${i.price * i.quantity}</strong>
        </div>
      `).join("") : '<p class="text-muted">No item records attached to this order.</p>'}
    </div>
    <div style="margin-top: 16px; text-align: right; font-size: 16px;">
      Total: <strong>₹${order.total_amount}</strong>
    </div>
  `;

  openModal("order-modal");
};

// 9. WAITLIST EXPORT
async function fetchWaitlist() {
  const tbody = document.getElementById("waitlist-table-body");
  const { data, error } = await supabase.from("waitlist").select("*").order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${error.message}</td></tr>`;
    return;
  }

  currentWaitlist = data || [];
  if (currentWaitlist.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No waitlist signups recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentWaitlist.map((w, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(w.email)}</strong></td>
      <td>${new Date(w.created_at).toLocaleDateString()} ${new Date(w.created_at).toLocaleTimeString()}</td>
    </tr>
  `).join("");
}

document.getElementById("export-waitlist-csv").addEventListener("click", () => {
  if (currentWaitlist.length === 0) {
    showToast("Waitlist is empty.", true);
    return;
  }

  let csv = "ID,Email,Date Joined\n";
  currentWaitlist.forEach(row => {
    csv += `"${row.id}","${row.email}","${row.created_at}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `BULKKOT_VIP_Waitlist_${new Date().toISOString().slice(0,10)}.csv`);
  a.click();
  showToast("CSV Exported successfully.");
});

// 10. MEDIA LIBRARY
async function fetchMediaLibrary() {
  const gallery = document.getElementById("media-gallery");
  const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list("catalog", { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

  if (error || !files) {
    gallery.innerHTML = `<p class="text-muted">No media found or bucket permissions need configuration.</p>`;
    return;
  }

  gallery.innerHTML = files.map(file => {
    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`catalog/${file.name}`);
    return `
      <div class="media-item">
        <img src="${publicUrl}" alt="${file.name}">
        <button type="button" class="media-copy-btn" onclick="navigator.clipboard.writeText('${publicUrl}'); showToast('URL copied to clipboard!');">Copy Link</button>
      </div>
    `;
  }).join("");
}

document.getElementById("media-direct-upload")?.addEventListener("change", async (e) => {
  await handleImageUploads(e.target.files);
  fetchMediaLibrary();
});

// Utilities
function escapeHtml(string) {
  return String(string || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Initial Boot
checkSession();
