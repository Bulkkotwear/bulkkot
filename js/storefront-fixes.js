/*
 * BULKKOT — safe storefront integration layer
 * Does not replace main.js/cart.js. It adds missing guardrails and UI polish.
 */
(function(){
  'use strict';

  const SUPABASE_URL='https://pgubjluqgqvrybvehzeh.supabase.co';
  const SUPABASE_KEY='sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP';
  const client = window.bulkkotSupabase || (window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY) : null);
  if(client && !window.bulkkotSupabase) window.bulkkotSupabase=client;

  function goSignIn(){
    const next=encodeURIComponent(location.pathname+location.search+location.hash);
    location.href='./signin.html?next='+next;
  }

  async function isAuthenticated(){
    if(!client) return false;
    try{ const {data}=await client.auth.getSession(); return !!data?.session?.user; }
    catch(_){ return false; }
  }

  function showGate(){
    const form=document.getElementById('storefrontCheckoutForm');
    if(!form || form.querySelector('.bk-auth-gate')) return;
    const gate=document.createElement('div');
    gate.className='bk-auth-gate';
    gate.innerHTML='<p class="bk-auth-gate__eyebrow">ACCOUNT REQUIRED</p><p class="bk-auth-gate__text">Sign in to continue checkout. Your order will be linked to your BULKKOT account so order history and tracking remain available.</p><button type="button" class="bk-auth-gate__button">SIGN IN / CREATE ACCOUNT</button>';
    gate.querySelector('button').addEventListener('click',goSignIn);
    form.prepend(gate);
  }

  // Checkout is authenticated by policy; block both the step transition and final submit.
  document.addEventListener('click',async function(e){
    const btn=e.target.closest('#proceedToCheckoutBtn');
    if(!btn) return;
    if(await isAuthenticated()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    goSignIn();
  },true);

  document.addEventListener('submit',async function(e){
    if(e.target?.id!=='storefrontCheckoutForm') return;
    if(await isAuthenticated()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    showGate();
    goSignIn();
  },true);

  // If the cart renders the checkout step for an unauthenticated visitor, make the state explicit.
  const observer=new MutationObserver(function(){
    const form=document.getElementById('storefrontCheckoutForm');
    if(form) isAuthenticated().then(ok=>{ if(!ok) showGate(); });
  });
  observer.observe(document.body,{childList:true,subtree:true});

  // Search UI enhancement: rich client-side filtering after the existing renderer updates the grid.
  function filterRenderedCards(value){
    const q=String(value||'').trim().toLowerCase();
    document.querySelectorAll('[data-product-card]').forEach(card=>{
      if(!q){card.hidden=false;return;}
      const text=card.textContent.toLowerCase();
      card.hidden=!text.includes(q);
    });
  }
  document.addEventListener('input',function(e){
    if(e.target?.id==='liveSearchInput') setTimeout(()=>filterRenderedCards(e.target.value),0);
  });

  // Close search with Escape, without disturbing other modal handlers.
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape') return;
    const bar=document.getElementById('headerSearchBar');
    if(bar?.classList.contains('is-active')) bar.classList.remove('is-active');
  });

  // Ensure all same-page nav links close the drawer before scrolling.
  document.addEventListener('click',function(e){
    const link=e.target.closest('a[href^="#"]');
    if(!link) return;
    const id=link.getAttribute('href');
    if(!id || id==='#') return;
    const drawer=document.querySelector('[data-mobile-drawer]');
    if(drawer?.classList.contains('is-open')){
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden','true');
      document.querySelector('.drawer-overlay')?.classList.remove('is-visible');
      document.body.classList.remove('drawer-open');
    }
  });

  // Keep the announcement ticker smooth even when its original animation is overridden elsewhere.
  const announcement=document.querySelector('.announcement-track');
  if(announcement && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    announcement.style.willChange='transform';
  }
})();
