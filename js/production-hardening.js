/* BULKKOT — final production hardening
 * Additive layer: validates checkout inputs, improves coupon feedback,
 * keeps account order summaries aligned with the secured order schema,
 * and normalizes tracking states without replacing the existing engines. */
(function () {
  'use strict';

  const RED = 'var(--bk-red, #e31b23)';

  function client() {
    return window.BULKKOT_SUPABASE_CLIENT || window.bulkkotSupabase || null;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }

  function showCheckoutError(message) {
    const box = document.getElementById('checkoutInlineError');
    if (!box) return;
    box.textContent = message;
    box.style.display = 'block';
    box.setAttribute('role', 'alert');
  }

  function validateCheckout() {
    const name = document.getElementById('chkName')?.value.trim() || '';
    const phone = (document.getElementById('chkPhone')?.value || '').replace(/\D/g, '');
    const email = document.getElementById('chkEmail')?.value.trim() || '';
    const address = document.getElementById('chkAddress')?.value.trim() || '';
    const city = document.getElementById('chkCity')?.value.trim() || '';
    const state = document.getElementById('chkState')?.value.trim() || '';
    const pin = document.getElementById('chkPincode')?.value.trim() || '';

    if (!name || !phone || !email || !address || !city || !state || !pin) {
      showCheckoutError('Please complete all required delivery details.');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      showCheckoutError('Please enter a valid 10-digit Indian mobile number.');
      document.getElementById('chkPhone')?.focus();
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showCheckoutError('Please enter a valid email address.');
      document.getElementById('chkEmail')?.focus();
      return false;
    }
    if (!/^\d{6}$/.test(pin)) {
      showCheckoutError('Please enter a valid 6-digit pincode.');
      document.getElementById('chkPincode')?.focus();
      return false;
    }
    return true;
  }

  function wireCheckoutValidation() {
    const form = document.getElementById('storefrontCheckoutForm');
    if (!form || form.dataset.bkValidation === '1') return;
    form.dataset.bkValidation = '1';
    form.addEventListener('submit', function (event) {
      if (!validateCheckout()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    ['chkName', 'chkPhone', 'chkEmail', 'chkAddress', 'chkCity', 'chkState', 'chkPincode'].forEach(id => {
      const input = document.getElementById(id);
      input?.addEventListener('input', () => {
        const box = document.getElementById('checkoutInlineError');
        if (box) box.style.display = 'none';
      });
    });
  }

  async function refreshAccountOrders() {
    const box = document.querySelector('[data-account-orders]');
    const db = client();
    if (!box || !db || box.dataset.bkOrdersRefreshing === '1') return;
    box.dataset.bkOrdersRefreshing = '1';
    try {
      const { data: auth } = await db.auth.getUser();
      const user = auth?.user;
      if (!user) return;
      const { data, error } = await db
        .from('orders')
        .select('order_number,status,total_amount,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data?.length) {
        box.innerHTML = '<p style="color:#777;font-size:11px;margin:10px 0;">No orders found yet.</p>';
        return;
      }
      box.innerHTML = data.map(order => {
        const status = String(order.status || 'PLACED').replace(/_/g, ' ').toUpperCase();
        return `<div class="bk-account-order">
          <div class="bk-account-order__top"><strong>${escapeHTML(order.order_number || 'ORDER')}</strong><span>${escapeHTML(status)}</span></div>
          <div class="bk-account-order__bottom"><time>${new Date(order.created_at).toLocaleDateString('en-IN')}</time><strong>${money(order.total_amount)}</strong></div>
        </div>`;
      }).join('');
    } catch (_) {
      /* Keep the existing account renderer if RLS/schema differs. */
    } finally {
      box.dataset.bkOrdersRefreshing = '0';
    }
  }

  function improveCoupon() {
    const input = document.getElementById('cartCouponInput');
    const button = document.getElementById('cartApplyCouponBtn');
    if (!input || !button || button.dataset.bkCoupon === '1') return;
    button.dataset.bkCoupon = '1';
    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase().replace(/\s+/g, '');
    });
  }

  function normalizeTracking() {
    const result = document.querySelector('[data-track-order-result]');
    if (!result || result.dataset.bkTracking === '1') return;
    result.dataset.bkTracking = '1';
    const status = result.querySelector('[data-track-result-status]');
    if (status && status.textContent) status.textContent = status.textContent.replace(/_/g, ' ').toUpperCase();
  }

  function applyStyles() {
    if (document.getElementById('bk-hardening-style')) return;
    const style = document.createElement('style');
    style.id = 'bk-hardening-style';
    style.textContent = `
      .bk-account-order{border:1px solid #222;border-radius:7px;padding:12px;margin-bottom:8px;background:#0c0c0c}
      .bk-account-order__top,.bk-account-order__bottom{display:flex;justify-content:space-between;gap:12px;align-items:center}
      .bk-account-order__top{font-size:12px;font-weight:800;color:#fff}
      .bk-account-order__top span{font-size:9px;letter-spacing:.08em;color:${RED};text-align:right}
      .bk-account-order__bottom{font-size:11px;color:#777;margin-top:7px}
      .bk-account-order__bottom strong{color:#fff}
      #checkoutInlineError{border-left:2px solid ${RED};padding-left:8px}
      #storefrontCheckoutForm .bk-input:invalid:not(:placeholder-shown){border-color:#5b2528}

      /* BULKKOT announcement — one seamless premium marquee */
      .announcement-bar{
        position:relative!important;
        display:block!important;
        width:100%!important;
        min-height:28px!important;
        height:28px!important;
        overflow:hidden!important;
        white-space:nowrap!important;
        background:#d60000!important;
        color:#000!important;
      }
      .announcement-track{
        display:flex!important;
        align-items:center!important;
        width:max-content!important;
        max-width:none!important;
        height:28px!important;
        margin:0!important;
        padding:0!important;
        transform:translate3d(0,0,0)!important;
        animation:bkAnnouncementMarquee 24s linear infinite!important;
        will-change:transform!important;
      }
      .announcement-content{
        flex:0 0 auto!important;
        display:flex!important;
        align-items:center!important;
        width:max-content!important;
        max-width:none!important;
        height:28px!important;
        margin:0!important;
        padding:0!important;
        gap:58px!important;
        white-space:nowrap!important;
      }
      .announcement-content span{
        flex:0 0 auto!important;
        display:inline-flex!important;
        align-items:center!important;
        white-space:nowrap!important;
        line-height:1!important;
        color:#000!important;
        font-family:var(--bk-heading)!important;
        font-size:8px!important;
        font-weight:800!important;
        letter-spacing:.18em!important;
      }
      .announcement-content span::before{color:#000!important;opacity:.45!important}
      .announcement-bar:hover .announcement-track{animation-play-state:paused!important}
      @keyframes bkAnnouncementMarquee{
        from{transform:translate3d(0,0,0)}
        to{transform:translate3d(-50%,0,0)}
      }
      @media(max-width:640px){
        .announcement-bar,.announcement-track,.announcement-content{height:26px!important;min-height:26px!important}
        .announcement-content{gap:44px!important}
        .announcement-content span{font-size:7px!important;letter-spacing:.16em!important}
      }
      @media(prefers-reduced-motion:reduce){
        .announcement-track{animation:none!important;transform:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    applyStyles();
    wireCheckoutValidation();
    improveCoupon();
    normalizeTracking();
    refreshAccountOrders();
  }

  const observer = new MutationObserver(boot);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
