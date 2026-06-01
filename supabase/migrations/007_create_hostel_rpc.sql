-- ============================================================
-- Migration 007: Hostel creation via RPC (bypasses RLS)
-- ============================================================

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
  -- Create the hostel
  insert into hostels (name, city, state, contact_phone, total_rooms, property_type)
  values (p_name, p_city, p_state, p_contact_phone, p_total_rooms, p_property_type)
  returning * into v_hostel;

  -- Determine role: shared = everyone is student, hostel/pg = creator is manager
  v_role := case when p_property_type = 'shared' then 'student'::user_role else 'manager'::user_role end;

  -- Link the calling user to this hostel
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

-- Join hostel by code RPC
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
  set hostel_id = v_hostel.id
  where id = auth.uid();

  return json_build_object(
    'id',            v_hostel.id,
    'name',          v_hostel.name,
    'hostel_code',   v_hostel.hostel_code,
    'property_type', v_hostel.property_type
  );
end;
$$;
