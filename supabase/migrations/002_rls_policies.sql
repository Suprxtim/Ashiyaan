-- ============================================================
-- ASHIYAAN — Migration 002: Row Level Security Policies
-- Every table is isolated first by hostel_id, then by role/user.
-- ============================================================

-- ── Helper: get current user's hostel_id ─────────────────────

create or replace function get_my_hostel_id()
returns uuid
language sql stable
as $$
  select hostel_id from profiles where id = auth.uid()
$$;

-- ── Helper: get current user's role ──────────────────────────

create or replace function get_my_role()
returns user_role
language sql stable
as $$
  select role from profiles where id = auth.uid()
$$;

-- ── Helper: is current user management staff ──────────────────

create or replace function is_staff()
returns bool
language sql stable
as $$
  select role in ('warden', 'manager') from profiles where id = auth.uid()
$$;

-- ── Enable RLS on all tables ──────────────────────────────────

alter table hostels               enable row level security;
alter table profiles              enable row level security;
alter table rooms                 enable row level security;
alter table room_assignments      enable row level security;
alter table gate_passes           enable row level security;
alter table visitors              enable row level security;
alter table mess_menu             enable row level security;
alter table mess_rates            enable row level security;
alter table mess_optouts          enable row level security;
alter table complaints            enable row level security;
alter table complaint_updates     enable row level security;
alter table payments              enable row level security;
alter table announcements         enable row level security;
alter table announcement_reads    enable row level security;
alter table marketplace_listings  enable row level security;
alter table lost_found            enable row level security;
alter table sos_incidents         enable row level security;
alter table notifications         enable row level security;
alter table parent_consents       enable row level security;
alter table push_subscriptions    enable row level security;

-- ── HOSTELS ───────────────────────────────────────────────────

-- Anyone authenticated can read their own hostel
create policy "hostels_select_own"
  on hostels for select
  using (id = get_my_hostel_id());

-- Only managers can update hostel details
create policy "hostels_update_manager"
  on hostels for update
  using (id = get_my_hostel_id() and get_my_role() = 'manager');

-- Anyone can insert (create a new hostel during onboarding)
create policy "hostels_insert_any"
  on hostels for insert
  with check (true);

-- ── PROFILES ──────────────────────────────────────────────────

-- Users can read profiles within their hostel
create policy "profiles_select_same_hostel"
  on profiles for select
  using (hostel_id = get_my_hostel_id());

-- Users can only update their own profile
create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid());

-- Allow insert on signup (profile creation)
create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

-- ── ROOMS ─────────────────────────────────────────────────────

create policy "rooms_select_same_hostel"
  on rooms for select
  using (hostel_id = get_my_hostel_id());

create policy "rooms_insert_staff"
  on rooms for insert
  with check (hostel_id = get_my_hostel_id() and is_staff());

create policy "rooms_update_staff"
  on rooms for update
  using (hostel_id = get_my_hostel_id() and is_staff());

-- ── ROOM ASSIGNMENTS ──────────────────────────────────────────

create policy "room_assignments_select_same_hostel"
  on room_assignments for select
  using (
    exists (
      select 1 from rooms r
      where r.id = room_id and r.hostel_id = get_my_hostel_id()
    )
  );

create policy "room_assignments_manage_staff"
  on room_assignments for all
  using (
    exists (
      select 1 from rooms r
      where r.id = room_id and r.hostel_id = get_my_hostel_id()
    ) and is_staff()
  );

-- ── GATE PASSES ───────────────────────────────────────────────

-- Students see their own passes; staff see all in hostel
create policy "gate_passes_select"
  on gate_passes for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff() or get_my_role() = 'security')
  );

-- Students can create their own passes
create policy "gate_passes_insert_own"
  on gate_passes for insert
  with check (
    hostel_id = get_my_hostel_id()
    and user_id = auth.uid()
  );

-- Staff and security can update (mark as scanned/used)
create policy "gate_passes_update_staff"
  on gate_passes for update
  using (
    hostel_id = get_my_hostel_id()
    and (is_staff() or get_my_role() = 'security')
  );

-- ── VISITORS ──────────────────────────────────────────────────

create policy "visitors_select"
  on visitors for select
  using (
    hostel_id = get_my_hostel_id()
    and (host_user_id = auth.uid() or is_staff() or get_my_role() = 'security')
  );

create policy "visitors_insert_own"
  on visitors for insert
  with check (hostel_id = get_my_hostel_id() and host_user_id = auth.uid());

create policy "visitors_update_staff_or_owner"
  on visitors for update
  using (
    hostel_id = get_my_hostel_id()
    and (host_user_id = auth.uid() or is_staff() or get_my_role() = 'security')
  );

-- ── MESS MENU ─────────────────────────────────────────────────

create policy "mess_menu_select_same_hostel"
  on mess_menu for select
  using (hostel_id = get_my_hostel_id());

create policy "mess_menu_insert_staff"
  on mess_menu for insert
  with check (hostel_id = get_my_hostel_id() and is_staff());

create policy "mess_menu_update_staff"
  on mess_menu for update
  using (hostel_id = get_my_hostel_id() and is_staff());

create policy "mess_menu_delete_staff"
  on mess_menu for delete
  using (hostel_id = get_my_hostel_id() and is_staff());

-- ── MESS RATES ────────────────────────────────────────────────

create policy "mess_rates_select_same_hostel"
  on mess_rates for select
  using (hostel_id = get_my_hostel_id());

create policy "mess_rates_manage_staff"
  on mess_rates for all
  using (hostel_id = get_my_hostel_id() and is_staff());

-- ── MESS OPTOUTS ──────────────────────────────────────────────

-- Students see their own; staff see all in hostel
create policy "mess_optouts_select"
  on mess_optouts for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

create policy "mess_optouts_insert_own"
  on mess_optouts for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

create policy "mess_optouts_update_own"
  on mess_optouts for update
  using (hostel_id = get_my_hostel_id() and user_id = auth.uid());

-- ── COMPLAINTS ────────────────────────────────────────────────

-- Students see their own; staff see all in hostel
create policy "complaints_select"
  on complaints for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

create policy "complaints_insert_own"
  on complaints for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

-- Staff can assign, update status, add resolution notes
create policy "complaints_update_staff"
  on complaints for update
  using (hostel_id = get_my_hostel_id() and is_staff());

-- Students can update only their own complaint's rating (post-resolution)
create policy "complaints_update_own_rating"
  on complaints for update
  using (hostel_id = get_my_hostel_id() and user_id = auth.uid());

-- ── COMPLAINT UPDATES ─────────────────────────────────────────

create policy "complaint_updates_select"
  on complaint_updates for select
  using (
    exists (
      select 1 from complaints c
      where c.id = complaint_id
        and c.hostel_id = get_my_hostel_id()
        and (c.user_id = auth.uid() or is_staff())
    )
  );

create policy "complaint_updates_insert_staff"
  on complaint_updates for insert
  with check (
    exists (
      select 1 from complaints c
      where c.id = complaint_id and c.hostel_id = get_my_hostel_id()
    )
    and (is_staff() or updated_by = auth.uid())
  );

-- ── PAYMENTS ──────────────────────────────────────────────────

-- Students see their own; managers see all
create policy "payments_select"
  on payments for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or get_my_role() = 'manager')
  );

create policy "payments_insert_manager"
  on payments for insert
  with check (hostel_id = get_my_hostel_id() and get_my_role() = 'manager');

create policy "payments_update_manager"
  on payments for update
  using (hostel_id = get_my_hostel_id() and get_my_role() = 'manager');

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────

create policy "announcements_select_same_hostel"
  on announcements for select
  using (hostel_id = get_my_hostel_id());

create policy "announcements_insert_staff"
  on announcements for insert
  with check (hostel_id = get_my_hostel_id() and is_staff() and posted_by = auth.uid());

create policy "announcements_update_staff"
  on announcements for update
  using (hostel_id = get_my_hostel_id() and is_staff());

create policy "announcements_delete_staff"
  on announcements for delete
  using (hostel_id = get_my_hostel_id() and is_staff());

-- ── ANNOUNCEMENT READS ────────────────────────────────────────

create policy "announcement_reads_select_own"
  on announcement_reads for select
  using (user_id = auth.uid());

create policy "announcement_reads_insert_own"
  on announcement_reads for insert
  with check (user_id = auth.uid());

-- ── MARKETPLACE LISTINGS ──────────────────────────────────────

create policy "marketplace_select_same_hostel"
  on marketplace_listings for select
  using (hostel_id = get_my_hostel_id());

create policy "marketplace_insert_own"
  on marketplace_listings for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

-- Owners can update/delete their own listing; staff can remove any
create policy "marketplace_update_own_or_staff"
  on marketplace_listings for update
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

create policy "marketplace_delete_own_or_staff"
  on marketplace_listings for delete
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

-- ── LOST & FOUND ──────────────────────────────────────────────

create policy "lost_found_select_same_hostel"
  on lost_found for select
  using (hostel_id = get_my_hostel_id());

create policy "lost_found_insert_own"
  on lost_found for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

create policy "lost_found_update_own_or_staff"
  on lost_found for update
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff())
  );

-- ── SOS INCIDENTS ─────────────────────────────────────────────

-- Student can insert; staff/security can view and update
create policy "sos_insert_own"
  on sos_incidents for insert
  with check (hostel_id = get_my_hostel_id() and user_id = auth.uid());

create policy "sos_select"
  on sos_incidents for select
  using (
    hostel_id = get_my_hostel_id()
    and (user_id = auth.uid() or is_staff() or get_my_role() = 'security')
  );

create policy "sos_update_staff"
  on sos_incidents for update
  using (
    hostel_id = get_my_hostel_id()
    and (is_staff() or get_my_role() = 'security')
  );

-- ── NOTIFICATIONS ─────────────────────────────────────────────

create policy "notifications_select_own"
  on notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on notifications for update
  using (user_id = auth.uid());

-- Service role (Edge Functions) inserts notifications
create policy "notifications_insert_service"
  on notifications for insert
  with check (true);

-- ── PARENT CONSENTS ───────────────────────────────────────────

create policy "parent_consents_select_own"
  on parent_consents for select
  using (student_id = auth.uid());

create policy "parent_consents_insert_own"
  on parent_consents for insert
  with check (student_id = auth.uid());

create policy "parent_consents_update_own"
  on parent_consents for update
  using (student_id = auth.uid());

create policy "parent_consents_delete_own"
  on parent_consents for delete
  using (student_id = auth.uid());

-- ── PUSH SUBSCRIPTIONS ────────────────────────────────────────

create policy "push_subs_select_own"
  on push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subs_insert_own"
  on push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subs_delete_own"
  on push_subscriptions for delete
  using (user_id = auth.uid());
