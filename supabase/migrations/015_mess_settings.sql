-- ============================================================
-- Migration 015: Mess Settings — per-hostel per-meal config
-- ============================================================

create table mess_settings (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references hostels(id) on delete cascade,
  meal_type    meal_type not null,
  enabled      bool not null default true,
  start_time   time not null,
  end_time     time not null,
  cutoff_time  time not null,
  unique(hostel_id, meal_type)
);

create index mess_settings_hostel_idx on mess_settings(hostel_id);

-- ── RLS ───────────────────────────────────────────────────────

alter table mess_settings enable row level security;

-- All authenticated users in the hostel can read settings
create policy "mess_settings_select"
  on mess_settings for select
  to authenticated
  using (hostel_id = (select hostel_id from profiles where id = auth.uid()));

-- Only warden / manager can write
create policy "mess_settings_insert"
  on mess_settings for insert
  to authenticated
  with check (
    hostel_id = (select hostel_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('warden', 'manager')
  );

create policy "mess_settings_update"
  on mess_settings for update
  to authenticated
  using (
    hostel_id = (select hostel_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('warden', 'manager')
  )
  with check (
    hostel_id = (select hostel_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('warden', 'manager')
  );

-- ── Seed defaults for all existing hostels ────────────────────

insert into mess_settings (hostel_id, meal_type, start_time, end_time, cutoff_time)
select id, 'breakfast'::meal_type, '08:00'::time, '10:00'::time, '07:30'::time from hostels
union all
select id, 'lunch'::meal_type,     '13:00'::time, '15:00'::time, '12:30'::time from hostels
union all
select id, 'dinner'::meal_type,    '20:00'::time, '22:00'::time, '19:30'::time from hostels
on conflict (hostel_id, meal_type) do nothing;

-- ── Update create_hostel_for_user RPC to seed defaults ────────

create or replace function create_hostel_for_user(
  p_name          text,
  p_city          text default null,
  p_state         text default null,
  p_contact_phone text default null,
  p_total_rooms   int  default null,
  p_property_type property_type default 'hostel'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostel    hostels;
  v_role      user_role;
begin
  insert into hostels (name, city, state, contact_phone, total_rooms, property_type)
  values (p_name, p_city, p_state, p_contact_phone, p_total_rooms, p_property_type)
  returning * into v_hostel;

  -- Seed default mess settings
  insert into mess_settings (hostel_id, meal_type, start_time, end_time, cutoff_time)
  values
    (v_hostel.id, 'breakfast'::meal_type, '08:00'::time, '10:00'::time, '07:30'::time),
    (v_hostel.id, 'lunch'::meal_type,     '13:00'::time, '15:00'::time, '12:30'::time),
    (v_hostel.id, 'dinner'::meal_type,    '20:00'::time, '22:00'::time, '19:30'::time);

  v_role := case when p_property_type = 'shared' then 'student'::user_role else 'manager'::user_role end;

  update profiles
  set hostel_id = v_hostel.id,
      role      = v_role
  where id = auth.uid();

  return json_build_object(
    'id',            v_hostel.id,
    'name',          v_hostel.name,
    'hostel_code',   v_hostel.hostel_code,
    'property_type', v_hostel.property_type
  );
end;
$$;
