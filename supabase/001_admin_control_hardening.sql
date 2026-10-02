-- BULKKOT ADMIN CONTROL / SECURITY HARDENING
-- Run once in Supabase SQL Editor. Review existing policies/functions before production use.
-- This migration is additive and does not drop product/order data.

create schema if not exists private;

-- ------------------------------------------------------------
-- CMS: keep public storefront reads, admin-only writes.
-- ------------------------------------------------------------
alter table if exists public.site_content enable row level security;

drop policy if exists "bulkkot_site_content_public_read" on public.site_content;
create policy "bulkkot_site_content_public_read"
on public.site_content for select
to anon, authenticated
using (true);

drop policy if exists "bulkkot_site_content_admin_insert" on public.site_content;
create policy "bulkkot_site_content_admin_insert"
on public.site_content for insert
to authenticated
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_site_content_admin_update" on public.site_content;
create policy "bulkkot_site_content_admin_update"
on public.site_content for update
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com')
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_site_content_admin_delete" on public.site_content;
create policy "bulkkot_site_content_admin_delete"
on public.site_content for delete
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

-- ------------------------------------------------------------
-- Store settings: public storefront read, admin-only writes.
-- ------------------------------------------------------------
alter table if exists public.store_settings enable row level security;

drop policy if exists "bulkkot_store_settings_public_read" on public.store_settings;
create policy "bulkkot_store_settings_public_read"
on public.store_settings for select
to anon, authenticated
using (true);

drop policy if exists "bulkkot_store_settings_admin_insert" on public.store_settings;
create policy "bulkkot_store_settings_admin_insert"
on public.store_settings for insert
to authenticated
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_store_settings_admin_update" on public.store_settings;
create policy "bulkkot_store_settings_admin_update"
on public.store_settings for update
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com')
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

-- ------------------------------------------------------------
-- Products: customers can only read visible/live catalogue.
-- Admin retains full CRUD.
-- ------------------------------------------------------------
alter table if exists public.products enable row level security;

drop policy if exists "bulkkot_products_public_read" on public.products;
create policy "bulkkot_products_public_read"
on public.products for select
to anon, authenticated
using (coalesce(active,true) = true and coalesce(visibility,true) = true);

drop policy if exists "bulkkot_products_admin_insert" on public.products;
create policy "bulkkot_products_admin_insert"
on public.products for insert
to authenticated
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_products_admin_update" on public.products;
create policy "bulkkot_products_admin_update"
on public.products for update
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com')
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_products_admin_delete" on public.products;
create policy "bulkkot_products_admin_delete"
on public.products for delete
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

-- ------------------------------------------------------------
-- Coupons: NEVER expose the table to storefront clients.
-- Storefront should use the validate_coupon RPC below.
-- ------------------------------------------------------------
alter table if exists public.coupons enable row level security;

drop policy if exists "bulkkot_coupons_admin_select" on public.coupons;
create policy "bulkkot_coupons_admin_select"
on public.coupons for select
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_coupons_admin_insert" on public.coupons;
create policy "bulkkot_coupons_admin_insert"
on public.coupons for insert
to authenticated
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_coupons_admin_update" on public.coupons;
create policy "bulkkot_coupons_admin_update"
on public.coupons for update
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com')
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_coupons_admin_delete" on public.coupons;
create policy "bulkkot_coupons_admin_delete"
on public.coupons for delete
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

-- Private validator. It exposes only the result for the supplied code.
create or replace function private.validate_coupon(p_code text, p_subtotal numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c public.coupons%rowtype;
declare discount numeric := 0;
begin
  select * into c
  from public.coupons
  where upper(code) = upper(trim(p_code))
    and coalesce(active,true) = true
  limit 1;

  if not found then
    return jsonb_build_object('valid',false,'message','Invalid or inactive coupon.');
  end if;

  if coalesce(c.min_order_value,0) > coalesce(p_subtotal,0) then
    return jsonb_build_object(
      'valid',false,
      'message','Minimum order value is ₹' || to_char(c.min_order_value,'FM9999999990')
    );
  end if;

  if lower(coalesce(c.discount_type,'')) = 'percentage' then
    discount := round(coalesce(p_subtotal,0) * coalesce(c.discount_value,0) / 100);
  else
    discount := least(coalesce(p_subtotal,0),coalesce(c.discount_value,0));
  end if;

  return jsonb_build_object(
    'valid',true,
    'code',upper(c.code),
    'discount_type',coalesce(c.discount_type,'fixed'),
    'discount_value',coalesce(c.discount_value,0),
    'min_order_value',coalesce(c.min_order_value,0),
    'discount_amount',greatest(0,discount)
  );
end;
$$;

revoke all on function private.validate_coupon(text,numeric) from public;
grant execute on function private.validate_coupon(text,numeric) to anon, authenticated;

create or replace function public.validate_coupon(p_code text, p_subtotal numeric default 0)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.validate_coupon(p_code,p_subtotal);
$$;

revoke all on function public.validate_coupon(text,numeric) from public;
grant execute on function public.validate_coupon(text,numeric) to anon, authenticated;

-- ------------------------------------------------------------
-- Customer profiles: customer owns own row; admin owns all.
-- ------------------------------------------------------------
alter table if exists public.customer_profiles enable row level security;

drop policy if exists "bulkkot_customer_own_select" on public.customer_profiles;
create policy "bulkkot_customer_own_select"
on public.customer_profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "bulkkot_customer_own_insert" on public.customer_profiles;
create policy "bulkkot_customer_own_insert"
on public.customer_profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "bulkkot_customer_own_update" on public.customer_profiles;
create policy "bulkkot_customer_own_update"
on public.customer_profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "bulkkot_customer_admin_select" on public.customer_profiles;
create policy "bulkkot_customer_admin_select"
on public.customer_profiles for select
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_customer_admin_update" on public.customer_profiles;
create policy "bulkkot_customer_admin_update"
on public.customer_profiles for update
to authenticated
using ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com')
with check ((select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

-- ------------------------------------------------------------
-- Waitlist: guests can insert; only admin can read/manage.
-- The storefront supports both 'waitlist' and legacy 'newsletter'.
-- Only apply these policies when the waitlist table exists.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.waitlist') is not null then
    execute 'alter table public.waitlist enable row level security';

    execute 'drop policy if exists "bulkkot_waitlist_public_insert" on public.waitlist';
    execute 'create policy "bulkkot_waitlist_public_insert"
      on public.waitlist for insert
      to anon, authenticated
      with check (true)';

    execute 'drop policy if exists "bulkkot_waitlist_admin_select" on public.waitlist';
    execute 'create policy "bulkkot_waitlist_admin_select"
      on public.waitlist for select
      to authenticated
      using ((select auth.jwt()->>''email'') = ''bulkkotwear@gmail.com'')';
  end if;
end $$;

-- ------------------------------------------------------------
-- Storage: admin-only uploads into site-content-images.
-- Keep the bucket public for storefront image delivery.
-- ------------------------------------------------------------
drop policy if exists "bulkkot_storage_admin_insert" on storage.objects;
create policy "bulkkot_storage_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-content-images'
  and (select auth.jwt()->>'email') = 'bulkkotwear@gmail.com'
);

drop policy if exists "bulkkot_storage_admin_update" on storage.objects;
create policy "bulkkot_storage_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'site-content-images' and (select auth.jwt()->>'email') = 'bulkkotwear@gmail.com')
with check (bucket_id = 'site-content-images' and (select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

drop policy if exists "bulkkot_storage_admin_delete" on storage.objects;
create policy "bulkkot_storage_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-content-images' and (select auth.jwt()->>'email') = 'bulkkotwear@gmail.com');

-- IMPORTANT:
-- Do NOT blindly replace your existing create_order() function here.
-- Its order_items schema is not visible from the public repository.
-- After inspecting the live database schema, make coupon + server-side totals
-- part of that transaction. Never trust browser totals for stock/payment/order totals.
