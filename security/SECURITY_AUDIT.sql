-- BULKKOT Supabase security audit (READ-ONLY)
-- Run in Supabase Dashboard > SQL Editor.
-- This script only inspects metadata; it does not change data, permissions, or policies.

-- 1) RLS enabled status for the public tables used by the storefront/admin.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
    'products', 'product_variants', 'orders', 'order_items',
    'customer_profiles', 'coupons', 'store_settings',
    'site_content', 'newsletter', 'waitlist'
  )
order by c.relname;

-- 2) Existing policies for those tables (roles, commands, USING, WITH CHECK).
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as check_expression
from pg_policies
where schemaname = 'public'
  and tablename in (
    'products', 'product_variants', 'orders', 'order_items',
    'customer_profiles', 'coupons', 'store_settings',
    'site_content', 'newsletter', 'waitlist'
  )
order by tablename, policyname;

-- 3) Security-sensitive functions and whether they run as SECURITY DEFINER.
-- Review create_order especially; its function body is shown for inspection.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_order')
order by p.proname;

-- 4) Storage bucket visibility for the site's media bucket.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('site-content-images');
