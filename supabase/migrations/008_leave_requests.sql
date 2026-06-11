-- ============================================================
-- Outpass / Leave Requests
-- ============================================================

create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table leave_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  hostel_id    uuid not null references hostels(id) on delete cascade,
  reason       text not null,
  destination  text,
  from_date    date not null,
  to_date      date not null,
  status       leave_status not null default 'pending',
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index leave_requests_user_idx   on leave_requests(user_id);
create index leave_requests_hostel_idx on leave_requests(hostel_id);
create index leave_requests_status_idx on leave_requests(status);
create index leave_requests_created_idx on leave_requests(created_at desc);

create trigger leave_requests_updated_at
  before update on leave_requests
  for each row execute function handle_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table leave_requests enable row level security;

-- Students see their own requests; staff see all in hostel
create policy "leave_requests_select"
  on leave_requests for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

-- Students can create their own requests
create policy "leave_requests_insert_own"
  on leave_requests for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

-- Staff can approve/reject any request in their hostel
create policy "leave_requests_update_staff"
  on leave_requests for update
  using (hostel_id = get_my_hostel_id() and is_staff())
  with check (hostel_id = get_my_hostel_id() and is_staff());

-- Students can cancel their own request while it's still pending
create policy "leave_requests_cancel_own"
  on leave_requests for update
  using (hostel_id = get_my_hostel_id() and user_id = auth.uid() and status = 'pending')
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid() and status = 'cancelled');
