-- ============================================================
-- Mess Feedback (per-meal star rating + comment)
-- ============================================================

create table mess_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  hostel_id   uuid not null references hostels(id) on delete cascade,
  date        date not null,
  meal_type   meal_type not null,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique(user_id, date, meal_type)
);

create index mess_feedback_hostel_idx on mess_feedback(hostel_id, date);

-- ── RLS ───────────────────────────────────────────────────────

alter table mess_feedback enable row level security;

-- Students see their own feedback; staff see all in hostel (for ratings overview)
create policy "mess_feedback_select"
  on mess_feedback for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

-- Students can submit their own feedback
create policy "mess_feedback_insert_own"
  on mess_feedback for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

-- Students can edit their own feedback
create policy "mess_feedback_update_own"
  on mess_feedback for update
  using (hostel_id = get_my_hostel_id() and user_id = auth.uid())
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());
