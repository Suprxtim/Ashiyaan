-- ============================================================
-- ASHIYAAN — Migration 014: Gate Trips (Trip-Based Gate Pass)
-- ============================================================

-- ── New enum ─────────────────────────────────────────────────

create type trip_status as enum ('pending', 'out', 'returned', 'overdue', 'cancelled');

-- ── Extend profiles with static QR identity token ────────────

alter table profiles
  add column if not exists qr_identity_token text unique;

-- Backfill existing profiles (safe to run multiple times)
update profiles
  set qr_identity_token = gen_random_uuid()::text
  where qr_identity_token is null;

alter table profiles
  alter column qr_identity_token set not null;

-- Update the handle_new_user trigger to include qr_identity_token
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, role, qr_identity_token)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    gen_random_uuid()::text
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── Extend hostels with curfew time ──────────────────────────

alter table hostels
  add column if not exists curfew_time time;

-- ── gate_trips table ─────────────────────────────────────────

create table gate_trips (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  hostel_id           uuid not null references hostels(id) on delete cascade,
  destination         text not null,
  purpose             text,
  expected_return_at  timestamptz not null,
  exit_at             timestamptz,
  exit_approved_by    uuid references profiles(id) on delete set null,
  return_at           timestamptz,
  return_logged_by    uuid references profiles(id) on delete set null,
  status              trip_status not null default 'pending',
  linked_leave_id     uuid references leave_requests(id) on delete set null,
  guard_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Only one pending trip per student at a time
create unique index gate_trips_one_pending_per_user
  on gate_trips(user_id) where (status = 'pending');

-- Only one out trip per student at a time
create unique index gate_trips_one_out_per_user
  on gate_trips(user_id) where (status = 'out');

create index gate_trips_user_idx   on gate_trips(user_id);
create index gate_trips_hostel_idx on gate_trips(hostel_id);
create index gate_trips_status_idx on gate_trips(status);
create index gate_trips_exit_idx   on gate_trips(exit_at desc nulls last);

create trigger gate_trips_updated_at
  before update on gate_trips
  for each row execute function handle_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

alter table gate_trips enable row level security;

-- Students see their own; staff and security see all in their hostel
create policy "gate_trips_select"
  on gate_trips for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff() or get_my_role() = 'security')
  );

-- Students create their own pending trips
create policy "gate_trips_insert_own"
  on gate_trips for insert
  with check (
    hostel_id = get_my_hostel_id()
    and user_id = auth.uid()
    and status = 'pending'
  );

-- Students cancel their own pending trips; staff/security update any trip in their hostel
create policy "gate_trips_update"
  on gate_trips for update
  using (
    hostel_id = get_my_hostel_id()
    and (
      (user_id = auth.uid() and status = 'pending')
      or is_staff()
      or get_my_role() = 'security'
    )
  );

-- ── Composite return type for scan RPCs ──────────────────────

create type trip_scan_result as (
  trip_id             uuid,
  student_name        text,
  room_number         text,
  destination         text,
  purpose             text,
  expected_return_at  timestamptz,
  exit_at             timestamptz,
  linked_leave_id     uuid,
  duration_minutes    int
);

-- ── RPC: approve exit ────────────────────────────────────────

create or replace function use_trip_exit(
  p_qr_token    text,
  p_guard_notes text default null
)
returns trip_scan_result
language plpgsql
security definer set search_path = public
as $$
declare
  v_student  profiles%rowtype;
  v_trip     gate_trips%rowtype;
  v_result   trip_scan_result;
begin
  -- Caller must be staff or security
  if not (is_staff() or get_my_role() = 'security') then
    raise exception 'Unauthorized';
  end if;

  -- Find student by static QR token
  select * into v_student
    from profiles
    where qr_identity_token = p_qr_token
    limit 1;

  if not found then
    raise exception 'Student not found';
  end if;

  -- Student must belong to caller's hostel
  if v_student.hostel_id != get_my_hostel_id() then
    raise exception 'Student not in your hostel';
  end if;

  -- Find the pending trip (SELECT FOR UPDATE to prevent race)
  select * into v_trip
    from gate_trips
    where user_id = v_student.id
      and status = 'pending'
    for update;

  if not found then
    raise exception 'No pending trip';
  end if;

  -- Approve exit
  update gate_trips
    set status           = 'out',
        exit_at          = now(),
        exit_approved_by = auth.uid(),
        guard_notes      = p_guard_notes,
        updated_at       = now()
    where id = v_trip.id;

  -- Build result
  v_result.trip_id            := v_trip.id;
  v_result.student_name       := v_student.full_name;
  v_result.room_number        := v_student.room_number;
  v_result.destination        := v_trip.destination;
  v_result.purpose            := v_trip.purpose;
  v_result.expected_return_at := v_trip.expected_return_at;
  v_result.exit_at            := now();
  v_result.linked_leave_id    := v_trip.linked_leave_id;
  v_result.duration_minutes   := null;

  return v_result;
end;
$$;

-- ── RPC: log return ──────────────────────────────────────────

create or replace function use_trip_return(
  p_qr_token    text,
  p_guard_notes text default null
)
returns trip_scan_result
language plpgsql
security definer set search_path = public
as $$
declare
  v_student  profiles%rowtype;
  v_trip     gate_trips%rowtype;
  v_result   trip_scan_result;
begin
  if not (is_staff() or get_my_role() = 'security') then
    raise exception 'Unauthorized';
  end if;

  select * into v_student
    from profiles
    where qr_identity_token = p_qr_token
    limit 1;

  if not found then
    raise exception 'Student not found';
  end if;

  if v_student.hostel_id != get_my_hostel_id() then
    raise exception 'Student not in your hostel';
  end if;

  -- Find the out trip (includes overdue — overdue is still 'out' logically)
  select * into v_trip
    from gate_trips
    where user_id = v_student.id
      and status in ('out', 'overdue')
    for update;

  if not found then
    raise exception 'No active trip';
  end if;

  update gate_trips
    set status            = 'returned',
        return_at         = now(),
        return_logged_by  = auth.uid(),
        guard_notes       = coalesce(p_guard_notes, guard_notes),
        updated_at        = now()
    where id = v_trip.id;

  v_result.trip_id            := v_trip.id;
  v_result.student_name       := v_student.full_name;
  v_result.room_number        := v_student.room_number;
  v_result.destination        := v_trip.destination;
  v_result.purpose            := v_trip.purpose;
  v_result.expected_return_at := v_trip.expected_return_at;
  v_result.exit_at            := v_trip.exit_at;
  v_result.linked_leave_id    := v_trip.linked_leave_id;
  v_result.duration_minutes   := floor(extract(epoch from (now() - v_trip.exit_at)) / 60)::int;

  return v_result;
end;
$$;

-- ── RPC: guard creates trip (direct to 'out') ─────────────────

create or replace function guard_create_trip(
  p_user_id             uuid,
  p_destination         text,
  p_expected_return_at  timestamptz,
  p_purpose             text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_student   profiles%rowtype;
  v_trip_id   uuid;
begin
  if not (is_staff() or get_my_role() = 'security') then
    raise exception 'Unauthorized';
  end if;

  select * into v_student from profiles where id = p_user_id;

  if not found then
    raise exception 'Student not found';
  end if;

  if v_student.hostel_id != get_my_hostel_id() then
    raise exception 'Student not in your hostel';
  end if;

  insert into gate_trips (
    user_id, hostel_id, destination, purpose,
    expected_return_at, status, exit_at, exit_approved_by
  )
  values (
    p_user_id, v_student.hostel_id, p_destination, p_purpose,
    p_expected_return_at, 'out', now(), auth.uid()
  )
  returning id into v_trip_id;

  return v_trip_id;
end;
$$;

-- ── Function: mark overdue (call via pg_cron every 5 min) ────

create or replace function mark_overdue_trips()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update gate_trips
    set status     = 'overdue',
        updated_at = now()
    where status = 'out'
      and expected_return_at < now();
end;
$$;

-- Enable realtime for gate_trips
alter publication supabase_realtime add table gate_trips;
