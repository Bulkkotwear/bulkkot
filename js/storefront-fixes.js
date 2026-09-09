/* BULKKOT — production storefront integration layer */
(function(){
  'use strict';

  const SUPABASE_URL='https://pgubjluqgqvrybvehzeh.supabase.co';
  const SUPABASE_KEY='sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP';
  const WHATSAPP_NUMBER='919462909101';
  const client=window.bulkkotSupabase||(window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null);
  if(client&&!window.bulkkotSupabase) window.bulkkotSupabase=client;
  document.documentElement.classList.add('bk-js');

  function goSignIn(){const next=encodeURIComponent(location.pathname+location.search+location.hash);location.href='./signin.html?next='+next;}
  async function isAuthenticated(){if(!client)return false;try{const {data}=await client.auth.getSession();return !!data?.session?.user;}catch(_){return false;}}

  function showGate(){
    const form=document.getElementById('storefrontCheckoutForm');
    if(!form||form.querySelector('.bk-auth-gate'))return;
    const gate=document.createElement('div');gate.className='bk-auth-gate';
    gate.innerHTML='<p class="bk-auth-gate__eyebrow">ACCOUNT REQUIRED</p><p class="bk-auth-gate__text">Sign in to continue checkout. Your order will be linked to your BULKKOT account so order history and tracking remain available.</p><button type="button" class="bk-auth-gate__button">SIGN IN / CREATE ACCOUNT</button>';
    gate.querySelector('button').addEventListener('click',goSignIn);form.prepend(gate);
  }

  document.addEventListener('click',async e=>{
    const btn=e.target.closest('#proceedToCheckoutBtn');
    if(!btn)return;
    if(await isAuthenticated())return;
    e.preventDefault();e.stopImmediatePropagation();goSignIn();
  },true);

  let onlinePaymentNoticeSent=false;

  function validateBeforePayment(){
    const name=document.getElementById('chkName')?.value.trim()||'';
    const phone=(document.getElementById('chkPhone')?.value||'').replace(/\D/g,'');
    const email=document.getElementById('chkEmail')?.value.trim()||'';
    const address=document.getElementById('chkAddress')?.value.trim()||'';
    const city=document.getElementById('chkCity')?.value.trim()||'';
    const state=document.getElementById('chkState')?.value.trim()||'';
    const pin=document.getElementById('chkPincode')?.value.trim()||'';
    const box=document.getElementById('checkoutInlineError');
    const fail=(message,id)=>{if(box){box.textContent=message;box.style.display='block';box.setAttribute('role','alert');}document.getElementById(id)?.focus();return false;};
    if(!name||!phone||!email||!address||!city||!state||!pin)return fail('Please complete all required delivery details.','chkName');
    if(!/^[6-9]\d{9}$/.test(phone))return fail('Please enter a valid 10-digit Indian mobile number.','chkPhone');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail('Please enter a valid email address.','chkEmail');
    if(!/^\d{6}$/.test(pin))return fail('Please enter a valid 6-digit pincode.','chkPincode');
    if(box)box.style.display='none';
    return true;
  }

  function openWhatsAppPayment(){
    const name=document.getElementById('chkName')?.value.trim()||'';
    const total=document.querySelector('#storefrontCheckoutForm .checkout-summary-total strong, #storefrontCheckoutForm .cart-total-strip strong')?.textContent||'';
    const message=`Hi BULKKOT, I want to make an online payment for my order.%0AName: ${encodeURIComponent(name)}%0AAmount: ${encodeURIComponent(total)}%0APlease share the UPI payment details.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`,'_blank','noopener,noreferrer');
    onlinePaymentNoticeSent=true;
    const btn=document.getElementById('cartSubmitOrderBtn');
    if(btn)btn.textContent='PLACE ONLINE ORDER →';
    const form=document.getElementById('storefrontCheckoutForm');
    if(form&&!form.querySelector('.bk-whatsapp-note')){
      const note=document.createElement('div');
      note.className='bk-whatsapp-note';
      note.innerHTML='<strong>PAYMENT STEP OPENED</strong><span>Complete payment details with BULKKOT on WhatsApp, then return here and place your order.</span>';
      form.appendChild(note);
    }
  }

  function handleOnlinePaymentStep(e){
    if(e.target?.id!=='storefrontCheckoutForm')return;
    const online=e.target.querySelector('input[name="payment_mode"][value="online"]:checked');
    if(!online||onlinePaymentNoticeSent)return;
    if(!validateBeforePayment()){
      e.preventDefault();e.stopImmediatePropagation();
      return;
    }
    e.preventDefault();e.stopImmediatePropagation();
    openWhatsAppPayment();
  }
  document.addEventListener('submit',async e=>{
    if(e.target?.id!=='storefrontCheckoutForm')return;
    if(!(await isAuthenticated())){e.preventDefault();e.stopImmediatePropagation();showGate();goSignIn();return;}
    handleOnlinePaymentStep(e);
  },true);

  /* Preserve the selected payment method and add the applied coupon to the RPC payload. */
  let rpcPatched=false;
  function patchOrderRpc(){
    if(!client||rpcPatched||typeof client.rpc!=='function')return;
    const originalRpc=client.rpc.bind(client);
    client.rpc=function(fn,args,options){
      if(fn==='create_order'&&args&&args.p_items&&args.p_customer){
        const coupon=document.getElementById('cartCouponInput')?.value?.trim().toUpperCase();
        args={...args,p_customer:{...(args.p_customer||{})}};
        if(coupon)args.p_customer.coupon_code=coupon;
      }
      return originalRpc(fn,args,options);
    };
    rpcPatched=true;
  }

  function stylePaymentOptions(){
    const form=document.getElementById('storefrontCheckoutForm');
    if(!form)return;
    const online=form.querySelector('input[name="payment_mode"][value="online"]');
    if(!online)return;
    online.disabled=false;
    online.removeAttribute('aria-disabled');
    const label=online.closest('.payment-card-label');
    if(label){label.style.opacity='1';label.style.cursor='pointer';const note=label.querySelector('small');if(note)note.textContent='Message BULKKOT on WhatsApp for payment details, then return here to place your order.';}
  }

  const observer=new MutationObserver(()=>{
    const form=document.getElementById('storefrontCheckoutForm');
    if(form){stylePaymentOptions();patchOrderRpc();isAuthenticated().then(ok=>{if(!ok)showGate();});}
  });
  observer.observe(document.body,{childList:true,subtree:true});

  function filterRenderedCards(value){const q=String(value||'').trim().toLowerCase();document.querySelectorAll('[data-product-card]').forEach(card=>{card.hidden=!!q&&!card.textContent.toLowerCase().includes(q);});}
  document.addEventListener('input',e=>{if(e.target?.id==='liveSearchInput')setTimeout(()=>filterRenderedCards(e.target.value),0);});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const bar=document.getElementById('headerSearchBar');if(bar?.classList.contains('is-active'))bar.classList.remove('is-active');});

  document.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');if(!link)return;
    const drawer=document.querySelector('[data-mobile-drawer]');
    if(drawer?.classList.contains('is-open')){drawer.classList.remove('is-open');drawer.setAttribute('aria-hidden','true');document.querySelector('.drawer-overlay')?.classList.remove('is-visible');document.body.classList.remove('drawer-open');}
  });

  function initLuxuryMotion(){
    const header=document.querySelector('.site-header');
    const revealTargets=document.querySelectorAll('.section-heading,.category-card,.editorial-slide,.drop-content,.shop-section,.about-section,.waitlist-section,.site-footer');
    revealTargets.forEach(el=>el.classList.add('bk-reveal'));
    if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('bk-visible');io.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -40px 0px'});revealTargets.forEach(el=>io.observe(el));}else revealTargets.forEach(el=>el.classList.add('bk-visible'));
    const onScroll=()=>header?.classList.toggle('bk-scrolled',window.scrollY>18);onScroll();window.addEventListener('scroll',onScroll,{passive:true});
    document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.bkFallbackApplied)return;const fallback='https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png';if(img.src!==fallback){img.dataset.bkFallbackApplied='1';img.src=fallback;}},true);
  }

  function initKeyboardUX(){document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;document.querySelectorAll('.is-open').forEach(el=>{if(el.matches('[data-cart-drawer],.pdp-modal,.quick-view-modal,[data-account-modal],[data-track-modal]')){el.classList.remove('is-open');el.setAttribute('aria-hidden','true');}});});}

  const announcement=document.querySelector('.announcement-track');if(announcement&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)announcement.style.willChange='transform';
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initLuxuryMotion();initKeyboardUX();patchOrderRpc();});else{initLuxuryMotion();initKeyboardUX();patchOrderRpc();}
})();