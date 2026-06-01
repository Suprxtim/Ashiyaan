-- ============================================================
-- Migration 004: Fix profiles RLS recursion
-- The helper functions queried `profiles` without bypassing RLS,
-- causing infinite recursion. Fix: security definer + direct own-row policy.
-- ============================================================

-- ── Make helper functions security definer (bypass RLS internally) ──

create or replace function get_my_hostel_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select hostel_id from profiles where id = auth.uid()
$$;

create or replace function get_my_role()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_staff()
returns bool
language sql stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('warden', 'manager') from profiles where id = auth.uid()),
    false
  )
$$;

-- ── Drop the recursive profiles select policy ──────────────────

drop policy if exists "profiles_select_same_hostel" on profiles;

-- ── Replace with two non-recursive policies ────────────────────

-- 1. Users can always read their own profile (no helper function needed)
create policy "profiles_select_own"
  on profiles for select
  using (id = auth.uid());

-- 2. Users can read all profiles in their hostel (now safe — helper is security definer)
create policy "profiles_select_same_hostel"
  on profiles for select
  using (hostel_id = get_my_hostel_id());
