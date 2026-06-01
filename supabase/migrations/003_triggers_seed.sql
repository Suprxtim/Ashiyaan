-- ============================================================
-- ASHIYAAN — Migration 003: Triggers, Functions & Seed Data
-- ============================================================

-- ── updated_at auto-update ────────────────────────────────────

create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function handle_updated_at();

create trigger complaints_updated_at
  before update on complaints
  for each row execute function handle_updated_at();

-- ── Auto-create profile on signup ─────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Auto-expire gate passes ───────────────────────────────────

create or replace function expire_gate_passes()
returns void
language plpgsql
security definer
as $$
begin
  update gate_passes
  set status = 'expired'
  where status = 'active'
    and expires_at < now();
end;
$$;

-- ── Auto-expire visitor passes ────────────────────────────────

create or replace function expire_visitors()
returns void
language plpgsql
security definer
as $$
begin
  update visitors
  set status = 'expired'
  where status in ('pending', 'approved')
    and pass_expiry < now();
end;
$$;

-- ── Auto-overdue payments ─────────────────────────────────────

create or replace function update_overdue_payments()
returns void
language plpgsql
security definer
as $$
begin
  update payments
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;
end;
$$;

-- ── Log complaint timeline on status change ───────────────────

create or replace function log_complaint_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status is distinct from new.status then
    insert into complaint_updates (complaint_id, updated_by, old_status, new_status)
    values (new.id, auth.uid(), old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger complaints_status_change
  after update on complaints
  for each row
  when (old.status is distinct from new.status)
  execute function log_complaint_update();

-- ── Notify student when complaint status changes ──────────────

create or replace function notify_complaint_update()
returns trigger
language plpgsql
security definer
as $$
declare
  v_title text;
  v_body  text;
begin
  v_title := case new.status
    when 'in_progress' then 'Complaint In Progress'
    when 'resolved'    then 'Complaint Resolved!'
    when 'closed'      then 'Complaint Closed'
    when 'rejected'    then 'Complaint Rejected'
    else 'Complaint Updated'
  end;

  v_body := 'Your complaint "' || new.title || '" is now ' || new.status::text || '.';

  insert into notifications (user_id, type, title, body, data)
  values (
    new.user_id,
    'complaint_update',
    v_title,
    v_body,
    jsonb_build_object('complaint_id', new.id, 'status', new.status)
  );

  return new;
end;
$$;

create trigger complaints_notify_student
  after update on complaints
  for each row
  when (old.status is distinct from new.status)
  execute function notify_complaint_update();

-- ── Notify warden on new complaint ───────────────────────────

create or replace function notify_warden_new_complaint()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into notifications (user_id, type, title, body, data)
  select
    p.id,
    'new_complaint',
    'New ' || new.priority::text || ' complaint',
    new.title,
    jsonb_build_object('complaint_id', new.id, 'priority', new.priority)
  from profiles p
  where p.hostel_id = new.hostel_id
    and p.role in ('warden', 'manager');

  return new;
end;
$$;

create trigger complaints_notify_warden
  after insert on complaints
  for each row execute function notify_warden_new_complaint();

-- ── Notify warden on SOS ──────────────────────────────────────

create or replace function notify_sos()
returns trigger
language plpgsql
security definer
as $$
declare
  v_student_name text;
begin
  select full_name into v_student_name
  from profiles where id = new.user_id;

  insert into notifications (user_id, type, title, body, data)
  select
    p.id,
    'sos_alert',
    '🚨 SOS ALERT',
    v_student_name || ' has triggered an emergency alert!',
    jsonb_build_object('sos_id', new.id, 'user_id', new.user_id)
  from profiles p
  where p.hostel_id = new.hostel_id
    and p.role in ('warden', 'manager', 'security');

  return new;
end;
$$;

create trigger sos_notify_staff
  after insert on sos_incidents
  for each row execute function notify_sos();

-- ── Supabase Realtime ─────────────────────────────────────────
-- Enable realtime for live updates on key tables

alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table complaints;
alter publication supabase_realtime add table sos_incidents;
alter publication supabase_realtime add table gate_passes;
alter publication supabase_realtime add table announcements;

-- ============================================================
-- SEED DATA — Development / Demo
-- Run this only in dev; skip in production
-- ============================================================

-- Demo hostel
insert into hostels (id, name, address, city, state, total_rooms, contact_phone, hostel_code)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Sunrise Boys Hostel',
  'Near City College, MG Road',
  'Bengaluru',
  'Karnataka',
  60,
  '+91-9876543210',
  'SUNRISE1'
);

-- Mess rates for demo hostel
insert into mess_rates (hostel_id, breakfast_rate, lunch_rate, dinner_rate, effective_from)
values (
  'a1b2c3d4-0000-0000-0000-000000000001',
  40.00,
  80.00,
  70.00,
  '2024-01-01'
);

-- Sample rooms
insert into rooms (hostel_id, room_number, floor, capacity, type, amenities)
values
  ('a1b2c3d4-0000-0000-0000-000000000001', '101', 1, 2, 'double', array['ac', 'wifi', 'attached_bathroom']),
  ('a1b2c3d4-0000-0000-0000-000000000001', '102', 1, 2, 'double', array['fan', 'wifi']),
  ('a1b2c3d4-0000-0000-0000-000000000001', '201', 2, 1, 'single', array['ac', 'wifi', 'attached_bathroom']),
  ('a1b2c3d4-0000-0000-0000-000000000001', '202', 2, 3, 'triple', array['fan', 'wifi']),
  ('a1b2c3d4-0000-0000-0000-000000000001', '301', 3, 2, 'double', array['ac', 'wifi']);

-- Allow created_by to be NULL (seed data has no real user yet)
alter table mess_menu alter column created_by drop not null;

-- Sample mess menu (current week)
insert into mess_menu (hostel_id, date, meal_type, items, created_by)
select
  'a1b2c3d4-0000-0000-0000-000000000001',
  current_date + i,
  meal,
  items,
  null
from (
  values
    (0, 'breakfast'::meal_type, array['Idli', 'Sambar', 'Coconut Chutney', 'Tea']),
    (0, 'lunch'::meal_type,     array['Rice', 'Dal', 'Aloo Sabzi', 'Curd', 'Pickle']),
    (0, 'dinner'::meal_type,    array['Chapati', 'Paneer Butter Masala', 'Dal Fry', 'Rice']),
    (1, 'breakfast'::meal_type, array['Poha', 'Jalebi', 'Tea']),
    (1, 'lunch'::meal_type,     array['Rice', 'Rajma', 'Jeera Aloo', 'Papad']),
    (1, 'dinner'::meal_type,    array['Chapati', 'Mix Veg', 'Dal Tadka', 'Rice']),
    (2, 'breakfast'::meal_type, array['Upma', 'Coconut Chutney', 'Tea']),
    (2, 'lunch'::meal_type,     array['Rice', 'Chole', 'Bhindi Fry', 'Curd']),
    (2, 'dinner'::meal_type,    array['Chapati', 'Palak Paneer', 'Dal', 'Rice']),
    (3, 'breakfast'::meal_type, array['Paratha', 'Pickle', 'Curd', 'Tea']),
    (3, 'lunch'::meal_type,     array['Rice', 'Dal Makhani', 'Aloo Gobi', 'Papad']),
    (3, 'dinner'::meal_type,    array['Chapati', 'Kadhai Paneer', 'Soup', 'Rice']),
    (4, 'breakfast'::meal_type, array['Dosa', 'Sambar', 'Chutney', 'Tea']),
    (4, 'lunch'::meal_type,     array['Rice', 'Dal', 'Mattar Paneer', 'Salad']),
    (4, 'dinner'::meal_type,    array['Chapati', 'Shahi Paneer', 'Dal', 'Rice']),
    (5, 'breakfast'::meal_type, array['Idli', 'Vada', 'Sambar', 'Tea']),
    (5, 'lunch'::meal_type,     array['Biryani', 'Raita', 'Papad', 'Salad']),
    (5, 'dinner'::meal_type,    array['Chapati', 'Paneer Bhurji', 'Dal', 'Rice']),
    (6, 'breakfast'::meal_type, array['Bread', 'Butter', 'Jam', 'Omelette', 'Tea']),
    (6, 'lunch'::meal_type,     array['Rice', 'Sambar', 'Rasam', 'Papad', 'Curd']),
    (6, 'dinner'::meal_type,    array['Chapati', 'Kadhi', 'Aloo Sabzi', 'Rice'])
) as t(i, meal, items)
on conflict (hostel_id, date, meal_type) do nothing;
