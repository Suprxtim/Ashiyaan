-- ============================================================
-- Migration 011: Student join approval flow
-- ============================================================

-- Modify join_hostel_by_code to set is_active = false so the
-- student lands in a pending state until a manager approves.
create or replace function join_hostel_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostel hostels;
begin
  select * into v_hostel
  from hostels
  where hostel_code = upper(trim(p_code));

  if not found then
    raise exception 'Invalid code. No place found with code %', p_code;
  end if;

  update profiles
  set hostel_id = v_hostel.id,
      is_active = false
  where id = auth.uid();

  return json_build_object(
    'id',            v_hostel.id,
    'name',          v_hostel.name,
    'hostel_code',   v_hostel.hostel_code,
    'property_type', v_hostel.property_type
  );
end;
$$;

-- Approve a pending student (manager/warden only, same hostel)
create or replace function approve_join_request(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role   user_role;
  v_caller_hostel uuid;
begin
  select role, hostel_id
  into v_caller_role, v_caller_hostel
  from profiles
  where id = auth.uid();

  if v_caller_role not in ('manager', 'warden') then
    raise exception 'Only managers and wardens can approve join requests';
  end if;

  update profiles
  set is_active = true
  where id        = p_user_id
    and hostel_id = v_caller_hostel
    and role      = 'student'
    and is_active = false;

  if not found then
    raise exception 'User not found or not a pending member of your hostel';
  end if;
end;
$$;

-- Reject a pending student — clears their hostel_id so they can retry
create or replace function reject_join_request(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role   user_role;
  v_caller_hostel uuid;
begin
  select role, hostel_id
  into v_caller_role, v_caller_hostel
  from profiles
  where id = auth.uid();

  if v_caller_role not in ('manager', 'warden') then
    raise exception 'Only managers and wardens can reject join requests';
  end if;

  update profiles
  set hostel_id = null,
      is_active = false
  where id        = p_user_id
    and hostel_id = v_caller_hostel
    and role      = 'student'
    and is_active = false;

  if not found then
    raise exception 'User not found or not a pending member of your hostel';
  end if;
end;
$$;

-- Enable realtime on profiles so PendingApprovalPage can subscribe
do $$
begin
  begin
    alter publication supabase_realtime add table profiles;
  exception when duplicate_object then
    null; -- already in publication, safe to ignore
  end;
end;
$$;
