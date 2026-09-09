(function(){'use strict';
const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}
function smoothTo(el){if(!el)return;el.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
function closeDrawer(){const d=$('[data-mobile-drawer]');if(!d)return;d.classList.remove('is-open');d.setAttribute('aria-hidden','true');$('.drawer-overlay')?.classList.remove('is-visible');document.body.classList.remove('drawer-open');}
function toast(message,type='info'){let t=$('.bk-toast');if(!t){t=document.createElement('div');t.className='bk-toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=message;t.dataset.type=type;t.classList.add('is-visible');clearTimeout(window.__bkToast);window.__bkToast=setTimeout(()=>t.classList.remove('is-visible'),3200)}

ready(()=>{
  /* Header state */
  const header=$('.site-header');
  const onScroll=()=>header?.classList.toggle('bk-scrolled',window.scrollY>18);
  onScroll();window.addEventListener('scroll',onScroll,{passive:true});

  /* Mobile menu: keep every route action deterministic */
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-open-drawer]')){
      const d=$('[data-mobile-drawer]');d?.classList.add('is-open');d?.setAttribute('aria-hidden','false');$('.drawer-overlay')?.classList.add('is-visible');document.body.classList.add('drawer-open');
    }
    if(e.target.closest('[data-close-drawer]')) closeDrawer();
    const link=e.target.closest('a[href^="#"]');
    if(link&&link.getAttribute('href')!=='#'){
      const target=$(link.getAttribute('href'));if(target){e.preventDefault();closeDrawer();smoothTo(target);history.replaceState(null,'',link.getAttribute('href'));}}
  });

  /* Category cards should actually filter the live catalogue */
  document.addEventListener('click',e=>{
    const card=e.target.closest('.category-card[data-category]');if(!card)return;
    const category=card.dataset.category;
    const shop=$('#shop');
    const filter=$(`[data-category-filter="${CSS.escape(category)}"]`)||$(`[data-filter="${CSS.escape(category)}"]`);
    if(filter){e.preventDefault();filter.click();smoothTo(shop);return;}
    if(window.BULKKOT_STORE?.setCategory){e.preventDefault();window.BULKKOT_STORE.setCategory(category);smoothTo(shop);}
  });

  /* Close transient surfaces with Escape. */
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;closeDrawer();$('.header-search-bar')?.classList.remove('is-active');document.body.classList.remove('modal-open','drawer-open');$$('[aria-modal="true"].is-open').forEach(x=>x.classList.remove('is-open'));});

  /* Image resilience: never show a broken campaign/product tile. */
  $$('img').forEach(img=>img.addEventListener('error',()=>{
    if(img.dataset.bkFallback==='1')return;img.dataset.bkFallback='1';img.src='https://raw.githubusercontent.com/Bulkkotwear/bulkkot/main/13575.png';img.classList.add('bk-image-fallback');
  },{once:false}));

  /* Reveal content only when it enters the viewport. */
  const revealTargets=$$('.category-card,.editorial-slide,.product-card,.drop-content,.section-heading,.about-section,.contact-section,.waitlist-section');
  revealTargets.forEach(el=>el.classList.add('bk-reveal'));
  if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('is-visible');io.unobserve(x.target)}}),{threshold:.08,rootMargin:'0px 0px -30px'});revealTargets.forEach(x=>io.observe(x))}else revealTargets.forEach(x=>x.classList.add('is-visible'));

  /* Prevent accidental double submissions on every important form. */
  document.addEventListener('submit',e=>{
    const form=e.target;if(!(form instanceof HTMLFormElement)||form.dataset.bkGuarded==='1')return;
    form.dataset.bkGuarded='1';const btn=form.querySelector('button[type="submit"],button:not([type])');
    if(btn){const original=btn.innerHTML;form.addEventListener('submit',()=>{btn.classList.add('is-loading');btn.setAttribute('aria-busy','true');btn.disabled=true;setTimeout(()=>{btn.classList.remove('is-loading');btn.removeAttribute('aria-busy');btn.disabled=false;},8000)},{once:true});}
  },true);

  /* External links: make outbound destinations intentional. */
  $$('a[href^="http"]').forEach(a=>{if(!a.target)a.target='_blank';if(!a.rel)a.rel='noopener noreferrer'});

  /* Add small utility affordance when the page becomes long. */
  let topBtn=$('.bk-back-top');if(!topBtn){topBtn=document.createElement('button');topBtn.className='bk-back-top';topBtn.type='button';topBtn.setAttribute('aria-label','Back to top');topBtn.innerHTML='↑';document.body.appendChild(topBtn)}
  const syncTop=()=>topBtn.classList.toggle('is-visible',window.scrollY>650);syncTop();window.addEventListener('scroll',syncTop,{passive:true});topBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));

  /* Network-aware image loading */
  if('connection' in navigator&&navigator.connection?.saveData){$$('img[loading="lazy"]').forEach(img=>img.loading='lazy')}
});

window.BULKKOT_LUXURY_FINAL={toast};
})();
