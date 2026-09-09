/* BULKKOT — production hardening */
(function () {
  'use strict';

  const RED = 'var(--bk-red, #e31b23)';
  const client = () => window.BULKKOT_SUPABASE_CLIENT || window.bulkkotSupabase || null;

  function showCheckoutError(message) {
    const box = document.getElementById('checkoutInlineError');
    if (!box) return;
    box.textContent = message;
    box.style.display = 'block';
    box.setAttribute('role', 'alert');
  }

  function validateCheckout() {
    const value = id => document.getElementById(id)?.value.trim() || '';
    const name = value('chkName');
    const phone = (document.getElementById('chkPhone')?.value || '').replace(/\D/g, '');
    const email = value('chkEmail');
    const address = value('chkAddress');
    const city = value('chkCity');
    const state = value('chkState');
    const pin = value('chkPincode');
    if (!name || !phone || !email || !address || !city || !state || !pin) {
      showCheckoutError('Please complete all required delivery details.'); return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) { showCheckoutError('Please enter a valid 10-digit Indian mobile number.'); document.getElementById('chkPhone')?.focus(); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showCheckoutError('Please enter a valid email address.'); document.getElementById('chkEmail')?.focus(); return false; }
    if (!/^\d{6}$/.test(pin)) { showCheckoutError('Please enter a valid 6-digit pincode.'); document.getElementById('chkPincode')?.focus(); return false; }
    return true;
  }

  function wireCheckoutValidation() {
    const form = document.getElementById('storefrontCheckoutForm');
    if (!form || form.dataset.bkValidation === '1') return;
    form.dataset.bkValidation = '1';
    form.addEventListener('submit', function (event) {
      if (!validateCheckout()) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    ['chkName','chkPhone','chkEmail','chkAddress','chkCity','chkState','chkPincode'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const box = document.getElementById('checkoutInlineError'); if (box) box.style.display = 'none';
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
      const user = auth?.user; if (!user) return;
      const { data, error } = await db.from('orders').select('order_number,status,total_amount,created_at').eq('user_id', user.id).order('created_at', { ascending:false });
      if (error) throw error;
      if (!data?.length) { box.innerHTML = '<p style="color:#777;font-size:11px;margin:10px 0;">No orders found yet.</p>'; return; }
      const escapeHTML = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
      box.innerHTML = data.map(order => `<div class="bk-account-order"><div class="bk-account-order__top"><strong>${escapeHTML(order.order_number || 'ORDER')}</strong><span>${escapeHTML(String(order.status || 'PLACED').replace(/_/g,' ').toUpperCase())}</span></div><div class="bk-account-order__bottom"><time>${new Date(order.created_at).toLocaleDateString('en-IN')}</time><strong>₹${Number(order.total_amount || 0).toLocaleString('en-IN')}</strong></div></div>`).join('');
    } catch (_) {} finally { box.dataset.bkOrdersRefreshing = '0'; }
  }

  function improveCoupon() {
    const input = document.getElementById('cartCouponInput');
    const button = document.getElementById('cartApplyCouponBtn');
    if (!input || !button || button.dataset.bkCoupon === '1') return;
    button.dataset.bkCoupon = '1';
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/\s+/g, ''); });
  }

  function normalizeTracking() {
    const result = document.querySelector('[data-track-order-result]');
    if (!result || result.dataset.bkTracking === '1') return;
    result.dataset.bkTracking = '1';
    const status = result.querySelector('[data-track-result-status]');
    if (status?.textContent) status.textContent = status.textContent.replace(/_/g, ' ').toUpperCase();
  }

  function applyStyles() {
    if (document.getElementById('bk-hardening-style')) return;
    const style = document.createElement('style');
    style.id = 'bk-hardening-style';
    style.textContent = `
      .bk-account-order{border:1px solid #222;border-radius:7px;padding:12px;margin-bottom:8px;background:#0c0c0c}
      .bk-account-order__top,.bk-account-order__bottom{display:flex;justify-content:space-between;gap:12px;align-items:center}
      .bk-account-order__top{font-size:12px;font-weight:800;color:#fff}.bk-account-order__top span{font-size:9px;letter-spacing:.08em;color:${RED};text-align:right}
      .bk-account-order__bottom{font-size:11px;color:#777;margin-top:7px}.bk-account-order__bottom strong{color:#fff}
      #checkoutInlineError{border-left:2px solid ${RED};padding-left:8px}
      #storefrontCheckoutForm .bk-input:invalid:not(:placeholder-shown){border-color:#5b2528}

      /* ANNOUNCEMENT — real seamless marquee; transform MUST NOT be !important */
      .announcement-bar{position:relative!important;display:block!important;width:100%!important;height:30px!important;min-height:30px!important;overflow:hidden!important;white-space:nowrap!important;background:#d60000!important;color:#000!important}
      .announcement-track{display:flex!important;align-items:center!important;width:max-content!important;max-width:none!important;height:30px!important;margin:0!important;padding:0!important;flex-wrap:nowrap!important;will-change:transform!important;animation:bkAnnouncementMarquee 22s linear infinite!important}
      .announcement-content{display:flex!important;align-items:center!important;flex:0 0 auto!important;width:max-content!important;max-width:none!important;height:30px!important;margin:0!important;padding:0 34px!important;gap:0!important;white-space:nowrap!important;flex-wrap:nowrap!important}
      .announcement-content span{display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;height:30px!important;white-space:nowrap!important;line-height:1!important;color:#000!important;font-family:var(--bk-heading)!important;font-size:8px!important;font-weight:800!important;letter-spacing:.18em!important;text-transform:uppercase!important}
      .announcement-content span + span::before{content:"/"!important;margin:0 28px!important;opacity:.42!important}
      .announcement-bar:hover .announcement-track{animation-play-state:paused!important}
      @keyframes bkAnnouncementMarquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
      @media(max-width:640px){.announcement-bar,.announcement-track,.announcement-content,.announcement-content span{height:27px!important;min-height:27px!important}.announcement-track{animation-duration:18s!important}.announcement-content{padding-inline:20px!important}.announcement-content span{font-size:7px!important;letter-spacing:.16em!important}.announcement-content span + span::before{margin-inline:20px!important}}
      @media(prefers-reduced-motion:reduce){.announcement-track{animation:none!important}}

      /* RESPONSIVE STOREFRONT — one clean system for desktop, tablet and phone */
      *,*::before,*::after{box-sizing:border-box}
      html,body{width:100%;max-width:100%;overflow-x:hidden}
      img,svg,video,canvas{max-width:100%}
      .site-header,.header-inner,main,.site-footer{max-width:100%;min-width:0}
      .header-inner{width:100%;padding-inline:clamp(16px,3vw,42px)}
      .desktop-navigation{flex-wrap:nowrap;white-space:nowrap}
      .header-actions{min-width:0;flex-shrink:0}
      .hero,.hero-media,.hero-image{width:100%;max-width:100%}
      .hero-image{display:block;height:100%;object-fit:cover;object-position:center center}
      .hero-content{width:min(700px,100%);max-width:calc(100% - 40px)}
      .category-row{width:100%;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2.2vw,28px);align-items:start}
      .category-card{min-width:0;width:100%}
      .category-image{width:100%;aspect-ratio:1/1;}
      .category-image img{display:block;width:100%;height:100%;object-fit:cover}
      .editorial-section,.editorial-carousel,.editorial-track,.editorial-slide{width:100%;max-width:100%;min-width:0}
      .editorial-slide img{display:block;width:100%;height:100%;object-fit:cover}
      .shop-section .shop-grid,.product-grid,[data-product-grid]{width:100%;min-width:0}
      .product-card{min-width:0;width:100%}
      .product-card__thumb{width:100%;overflow:hidden}
      .product-card__thumb img{display:block;width:100%;height:100%;object-fit:cover}
      .product-information,.product-information__header{min-width:0}
      .product-information__header h3{overflow-wrap:anywhere}
      .shop-toolbar{min-width:0;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
      .shop-toolbar>*{min-width:0}
      .drop-section,.drop-content,.about-section,.contact-section,.waitlist-section{max-width:100%;min-width:0}
      .drop-content{width:min(720px,calc(100% - 40px))}
      .modal-overlay,[data-modal-overlay]{overflow:auto;-webkit-overflow-scrolling:touch}
      .pdp-modal,.quick-view-modal{max-width:calc(100vw - 24px);max-height:calc(100svh - 24px);overflow:auto}
      [data-cart-drawer]{max-width:100vw;height:100svh;overflow:hidden}
      .cart-body-wrapper{min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}
      #storefrontCheckoutForm{width:100%;max-width:100%;min-width:0}
      #storefrontCheckoutForm input,#storefrontCheckoutForm select,#storefrontCheckoutForm textarea{max-width:100%;min-width:0}
      .site-footer{overflow:hidden}

      @media(min-width:1200px){
        .header-inner{min-height:76px}
        .hero-content{max-width:760px}
        .category-row{gap:28px}
        .product-grid,[data-product-grid]{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      }

      @media(min-width:641px) and (max-width:1199px){
        .desktop-navigation{gap:18px!important}
        .desktop-navigation a{font-size:8px!important;letter-spacing:.13em!important}
        .header-actions{gap:9px!important}
        .header-track-order{display:none!important}
        .category-row{gap:16px}
        .product-grid,[data-product-grid]{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        .hero-content h1{font-size:clamp(60px,10vw,104px)!important}
      }

      @media(max-width:900px){
        .header-menu{display:flex!important;flex:0 0 auto}
        .desktop-navigation{display:none!important}
        .header-inner{min-height:62px;padding-inline:16px}
        .brand{min-width:0}
        .header-actions{gap:8px!important}
        .header-track-order{display:none!important}
        .header-account{display:none!important}
        .instagram-action{display:none!important}
        .header-action{width:34px!important;height:34px!important;flex:0 0 34px}
        .category-section,.shop-section,.about-section,.contact-section{padding-inline:18px!important}
        .drop-section,.waitlist-section{padding-inline:18px!important}
        .editorial-section{padding-inline:0!important}
        .shop-toolbar{align-items:stretch}
        .shop-toolbar select,.shop-toolbar button{min-height:40px}
      }

      @media(max-width:640px){
        .header-inner{min-height:58px;padding-inline:12px}
        .header-menu{width:34px;height:34px;padding:8px!important}
        .brand{gap:7px!important;max-width:calc(100% - 112px);overflow:hidden}
        .brand-name{min-width:0;white-space:nowrap}
        .brand-korean,.brand-english{white-space:nowrap}
        .header-actions{margin-left:auto;gap:5px!important}
        .header-action{width:32px!important;height:32px!important;flex-basis:32px}
        .header-action svg{width:17px;height:17px}
        .header-search-bar{width:100%!important;max-width:100%!important}
        .header-search-input-wrap{width:100%!important;max-width:100%!important;gap:7px!important}
        .header-search-input-wrap input{min-width:0;width:100%;font-size:12px!important}
        .header-search-execute-btn{flex:0 0 auto}
        .hero{min-height:calc(100svh - 58px)!important}
        .hero-content{max-width:calc(100% - 32px);padding-inline:0!important}
        .hero-content h1{font-size:clamp(52px,18vw,86px)!important;line-height:.9!important}
        .hero-description{max-width:300px;font-size:11px!important;line-height:1.65!important}
        .hero-content .button{max-width:100%;min-height:46px!important;padding-inline:18px!important}
        .category-section,.shop-section,.about-section,.contact-section{padding:58px 16px!important}
        .category-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important}
        .category-name{padding:11px 6px!important;text-align:center}
        .category-name strong,.category-name h3{font-size:9px!important;letter-spacing:.1em!important}
        .category-name span{font-size:8px!important}
        .editorial-slide__content{padding:20px!important}
        .editorial-slide__content h2{font-size:clamp(27px,9vw,42px)!important}
        .editorial-slide__content span{font-size:10px!important;letter-spacing:.16em!important}
        .carousel-control{width:34px!important;height:34px!important}
        .shop-toolbar{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
        .shop-toolbar>*{width:100%!important}
        .product-grid,[data-product-grid]{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
        .product-information{padding:10px!important}
        .product-information__header{display:block!important}
        .product-information__header h3{font-size:11px!important;line-height:1.35!important}
        .product-category{font-size:7px!important;margin-top:4px!important}
        .product-price{font-size:10px!important;margin-top:6px!important}
        .product-sizes-row{gap:4px!important;flex-wrap:wrap}
        .product-size-btn{min-width:27px!important;width:27px!important;height:28px!important}
        .product-add-button{min-height:40px!important;margin-top:8px!important;font-size:8px!important}
        .drop-section,.waitlist-section{padding-inline:16px!important}
        .drop-content{width:100%;max-width:100%}
        .drop-content p:not(.eyebrow){font-size:11px!important;line-height:1.7!important}
        .site-footer{padding-inline:16px!important}
        .site-footer .footer-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:28px 18px!important}
        [data-cart-drawer]{width:100vw!important;max-width:100vw!important}
        .cart-drawer__header{padding-inline:16px!important}
        .cart-body-wrapper{padding-inline:16px!important}
        .cart-drawer__footer{padding-inline:16px!important;padding-bottom:max(18px,env(safe-area-inset-bottom))!important}
        .pdp-modal,.quick-view-modal{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important;max-height:calc(100svh - 16px)!important}
        #storefrontCheckoutForm{font-size:12px}
        #storefrontCheckoutForm [style*="grid-template-columns:1fr 1fr"],#storefrontCheckoutForm [style*="grid-template-columns:1fr 1fr 1fr"]{grid-template-columns:1fr!important}
      }

      @media(min-width:641px){
        .header-menu{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    applyStyles(); wireCheckoutValidation(); improveCoupon(); normalizeTracking(); refreshAccountOrders();
  }
  const observer = new MutationObserver(boot);
  observer.observe(document.body, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();