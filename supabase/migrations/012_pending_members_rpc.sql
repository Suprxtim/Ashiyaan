create or replace function get_pending_members(p_hostel_id uuid)
returns table (id uuid, full_name text, phone text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can view pending members';
  end if;

  return query
  select p.id, p.full_name, p.phone, p.created_at
  from profiles p
  where p.hostel_id  = p_hostel_id
    and p.role       = 'student'
    and p.is_active  = false
  order by p.created_at asc;
end;
$$;
