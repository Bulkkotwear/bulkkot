/* BULKKOT — safe storefront integration layer
 * Additive only: preserves the existing main.js/cart.js architecture. */
(function(){
  'use strict';

  /* Compatibility bootstrap: only inject the final layer when the page has not already linked it. */
  (function loadFinalLayer(){
    if(!document.querySelector('link[href$="css/luxury-final.css"],link[data-bk-luxury-final]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='css/luxury-final.css';css.dataset.bkLuxuryFinal='1';document.head.appendChild(css);
    }
    if(!document.querySelector('script[src$="js/luxury-final.js"],script[data-bk-luxury-final]')){
      const js=document.createElement('script');js.src='js/luxury-final.js';js.defer=true;js.dataset.bkLuxuryFinal='1';document.head.appendChild(js);
    }
  })();

  const SUPABASE_URL='https://pgubjluqgqvrybvehzeh.supabase.co';
  const SUPABASE_KEY='sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP';
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

  document.addEventListener('click',async e=>{const btn=e.target.closest('#proceedToCheckoutBtn');if(!btn)return;if(await isAuthenticated())return;e.preventDefault();e.stopImmediatePropagation();goSignIn();},true);
  document.addEventListener('submit',async e=>{if(e.target?.id!=='storefrontCheckoutForm')return;if(await isAuthenticated())return;e.preventDefault();e.stopImmediatePropagation();showGate();goSignIn();},true);

  const observer=new MutationObserver(()=>{const form=document.getElementById('storefrontCheckoutForm');if(form)isAuthenticated().then(ok=>{if(!ok)showGate();});});
  observer.observe(document.body,{childList:true,subtree:true});

  function filterRenderedCards(value){const q=String(value||'').trim().toLowerCase();document.querySelectorAll('[data-product-card]').forEach(card=>{card.hidden=!!q&&!card.textContent.toLowerCase().includes(q);});}
  document.addEventListener('input',e=>{if(e.target?.id==='liveSearchInput')setTimeout(()=>filterRenderedCards(e.target.value),0);});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const bar=document.getElementById('headerSearchBar');if(bar?.classList.contains('is-active'))bar.classList.remove('is-active');});

  document.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');if(!link)return;const id=link.getAttribute('href');if(!id||id==='#')return;
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initLuxuryMotion();initKeyboardUX();});else{initLuxuryMotion();initKeyboardUX();}
})();
