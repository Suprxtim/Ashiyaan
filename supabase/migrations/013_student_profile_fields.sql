-- Add extended student profile fields
alter table profiles
  add column if not exists college_name        text,
  add column if not exists course              text,
  add column if not exists college_year        text,
  add column if not exists blood_group         text,
  add column if not exists date_of_birth       date,
  add column if not exists aadhaar_number      text,
  add column if not exists hometown            text,
  add column if not exists parent_name         text,
  add column if not exists parent_phone        text,
  add column if not exists allergies           text,
  add column if not exists medical_conditions  text,
  add column if not exists profile_completed   bool not null default false;

-- assign_room: staff-only RPC that sets profiles.room_number for a student
create or replace function assign_room(p_user_id uuid, p_room_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_hostel uuid;
  v_caller_hostel  uuid;
begin
  if not is_staff() then
    raise exception 'Only staff can assign rooms';
  end if;

  select hostel_id into v_caller_hostel
  from profiles where id = auth.uid();

  select hostel_id into v_student_hostel
  from profiles where id = p_user_id;

  if v_student_hostel is null or v_student_hostel != v_caller_hostel then
    raise exception 'Student not in your hostel';
  end if;

  update profiles
  set room_number = nullif(trim(p_room_number), ''),
      updated_at  = now()
  where id = p_user_id;
end;
$$;
