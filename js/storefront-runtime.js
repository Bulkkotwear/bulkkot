(function(){
'use strict';
const SUPABASE_URL='https://pgubjluqgqvrybvehzeh.supabase.co';
const SUPABASE_KEY='sb_publishable_JczzlCxDhkDctBeTuGhEjg_mkOtJIyP';
const sb=window.bulkkotSupabase||(window.supabase&&window.supabase.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null);
if(!sb)return;
window.BULKKOT_RUNTIME={ready:false,config:{},refresh:load};
const SELECTORS={
brand_name:['.brand-english'],brand_korean:['.brand-korean','.hero-korean'],brand_tagline:['.footer-tagline'],
hero_image:['.hero-image'],hero_eyebrow:['.hero-korean'],hero_title:['.hero-content h1'],hero_label:['.hero-label'],hero_description:['.hero-description'],hero_cta:['.hero-content .button--primary'],
collections_eyebrow:['#collections .circle-collections-head .eyebrow'],collections_title:['#collections .circle-collections-head h2'],
drop_eyebrow:['#drop-001 .eyebrow'],drop_title:['#drop-001 h2'],drop_description:['#drop-001 .drop-content > p:nth-of-type(2)'],drop_cta:['#drop-001 .button'],
values_eyebrow:['.values-section .section-heading .eyebrow'],values_title:['.values-section .section-heading h2'],
about_eyebrow:['.about-section .about-intro .eyebrow'],about_title:['.about-section .about-intro h2'],about_subtitle:['.about-section .about-intro span'],about_lead:['.about-lead'],about_signature:['.about-signature'],about_cta:['.about-copy [data-open-about]'],
philosophy_korean:['.philosophy-korean'],philosophy_title:['.philosophy-section h2'],philosophy_subtitle:['.philosophy-section h3'],philosophy_description:['.philosophy-section > p:last-child'],
social_eyebrow:['.instagram-section .eyebrow'],social_title:['.instagram-section h2'],social_korean:['.instagram-section .section-heading span'],instagram_handle:['.instagram-handle'],
waitlist_eyebrow:['#waitlist .eyebrow'],waitlist_title:['#waitlist h2'],waitlist_korean:['#waitlist .waitlist-copy > span'],waitlist_description:['#waitlist .waitlist-copy > p'],waitlist_placeholder:['#waitlist-email'],waitlist_button:['#waitlist .waitlist-form button'],
contact_eyebrow:['#contact .eyebrow'],contact_title:['#contact h2'],contact_email:['#contact .contact-item strong'],
footer_description:['.footer-brand > p:first-of-type'],footer_tagline:['.footer-tagline'],footer_copyright:['.footer-bottom span:first-child'],footer_country:['.footer-bottom span:last-child'],
nav_home:['.desktop-navigation a:nth-child(1)'],nav_shop:['.desktop-navigation a:nth-child(2)'],nav_drop:['.desktop-navigation a:nth-child(3)'],nav_collections:['.desktop-navigation a:nth-child(4)'],nav_about:['.desktop-navigation a:nth-child(5)'],
search_placeholder:['#liveSearchInput','.shop-search']};
function nodes(key){return (SELECTORS[key]||[]).flatMap(s=>Array.from(document.querySelectorAll(s)));}
function text(key,val){if(val==null)return;nodes(key).forEach(el=>{if(el.tagName==='INPUT'||el.tagName==='TEXTAREA')el.value=val;else el.textContent=val;});}
function attr(key,val,name){if(val==null)return;nodes(key).forEach(el=>el.setAttribute(name,val));}
function applyGeneric(key,val){document.querySelectorAll('[data-cms-key="'+CSS.escape(key)+'"]').forEach(el=>{if(el.tagName==='IMG')el.src=val;else el.textContent=val;});}
function applyLinks(key,val){if(!val)return;nodes(key).forEach(el=>{if(el.tagName==='A')el.href=val;});}
function rgba(h,a){h=String(h||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return 'rgba(0,0,0,'+a+')';return 'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+a+')';}
function applyConfig(cfg,settings){
Object.entries(cfg).forEach(([k,v])=>{applyGeneric(k,v);if(SELECTORS[k])text(k,v);});
['hero_cta_url','collection_1_url','collection_2_url','collection_3_url','editorial_1_url','editorial_2_url','editorial_3_url','editorial_4_url','drop_cta_url','shop_catalogue_url','about_cta_url','popup_cta_url'].forEach(k=>applyLinks(k,cfg[k]));
if(cfg.logo_url)document.querySelectorAll('.brand-logo').forEach(i=>i.src=cfg.logo_url);if(cfg.favicon_url)document.querySelector('link[rel="icon"]')?.setAttribute('href',cfg.favicon_url);
if(cfg.meta_title)document.title=cfg.meta_title;if(cfg.meta_description)document.querySelector('meta[name="description"]')?.setAttribute('content',cfg.meta_description);
if(cfg.theme_red)document.documentElement.style.setProperty('--bk-red',cfg.theme_red);
if(cfg.announcement_bg)document.querySelector('.announcement-bar')?.style.setProperty('background-color',cfg.announcement_bg);if(cfg.announcement_color)document.querySelector('.announcement-bar')?.style.setProperty('color',cfg.announcement_color);if(cfg.announcement_speed)document.querySelector('.announcement-track')?.style.setProperty('animation-duration',String(cfg.announcement_speed)+'s');
if(cfg.hero_overlay_color){const o=document.querySelector('.hero-overlay');if(o)o.style.background='linear-gradient(90deg,'+rgba(cfg.hero_overlay_color,.76)+' 0%,'+rgba(cfg.hero_overlay_color,.38)+' 42%,'+rgba(cfg.hero_overlay_color,.18)+' 100%)';}
const phone=String(settings?.support_phone||cfg.whatsapp_number||'').replace(/\D/g,'');if(phone)document.querySelectorAll('.whatsapp-float').forEach(a=>a.href='https://wa.me/'+phone+'?text='+encodeURIComponent(cfg.whatsapp_message||'Hi BULKKOT, I have an inquiry.'));
const email=settings?.support_email||cfg.contact_email;if(email)document.querySelectorAll('a[href^="mailto:"]').forEach(a=>a.href='mailto:'+email);
if(cfg.instagram_url)document.querySelectorAll('a[href*="instagram.com"]').forEach(a=>a.href=cfg.instagram_url);
if(cfg.popup_enabled!==undefined&&String(cfg.popup_enabled).toLowerCase()==='false')document.getElementById('welcomePopupModal')?.remove();
if(String(cfg.store_maintenance).toLowerCase()==='true'&&!document.body.dataset.adminPreview)document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;background:#070707;color:#fff;font:14px system-ui;text-align:center;padding:24px"><div><div style="letter-spacing:.2em;color:#e31b23;font-weight:800;font-size:10px">BULKKOT</div><h1 style="margin:10px 0">STORE MAINTENANCE</h1><p style="color:#888">We are preparing the next release. Please check back shortly.</p></div></main>';
}
async function load(){try{const [{data:c},{data:s}]=await Promise.all([sb.from('site_content').select('key,value,content_key,content_value'),sb.from('store_settings').select('*').eq('id',1).maybeSingle()]);const cfg={};(c||[]).forEach(r=>{const k=r.content_key||r.key;if(k)cfg[k]=r.content_value??r.value??'';});applyConfig(cfg,s||{});window.BULKKOT_RUNTIME.config=cfg;window.BULKKOT_RUNTIME.ready=true;}catch(e){console.warn('BULKKOT runtime config unavailable',e);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();