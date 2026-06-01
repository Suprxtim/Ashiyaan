-- Fix hostels INSERT policy — explicitly target authenticated role

drop policy if exists "hostels_insert_any" on hostels;

create policy "hostels_insert_authenticated"
  on hostels for insert
  to authenticated
  with check (true);

-- Also fix profiles insert for onboarding edge case
drop policy if exists "profiles_insert_own" on profiles;

create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());
