-- ============================================================
-- ASHIYAAN — Migration 001: Initial Schema
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

create type user_role as enum ('student', 'warden', 'manager', 'security', 'parent');
create type pass_type as enum ('entry', 'exit');
create type pass_status as enum ('active', 'used', 'expired');
create type meal_type as enum ('breakfast', 'lunch', 'dinner');
create type complaint_category as enum ('electrical', 'plumbing', 'wifi', 'cleaning', 'furniture', 'other');
create type complaint_priority as enum ('low', 'medium', 'high', 'urgent');
create type complaint_status as enum ('submitted', 'in_progress', 'resolved', 'closed', 'rejected');
create type payment_type as enum ('rent', 'mess', 'electricity', 'maintenance', 'other');
create type payment_status as enum ('pending', 'paid', 'overdue');
create type room_type as enum ('single', 'double', 'triple', 'dormitory');
create type announcement_category as enum ('general', 'event', 'rule', 'emergency', 'maintenance');
create type listing_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
create type listing_status as enum ('active', 'sold', 'removed');
create type lostfound_type as enum ('lost', 'found');
create type visitor_status as enum ('pending', 'approved', 'arrived', 'left', 'expired');
create type sos_status as enum ('active', 'responded', 'resolved');

-- ── Hostels ───────────────────────────────────────────────────

create table hostels (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  city          text,
  state         text,
  total_rooms   int,
  contact_phone text,
  hostel_code   text unique not null default upper(substring(gen_random_uuid()::text, 1, 8)),
  subscription  text not null default 'free',
  created_at    timestamptz not null default now()
);

-- ── Profiles (extends auth.users) ────────────────────────────

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  hostel_id    uuid references hostels(id) on delete set null,
  full_name    text not null,
  phone        text,
  role         user_role not null default 'student',
  room_number  text,
  student_id   text,
  avatar_url   text,
  is_active    bool not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Rooms ─────────────────────────────────────────────────────

create table rooms (
  id          uuid primary key default gen_random_uuid(),
  hostel_id   uuid not null references hostels(id) on delete cascade,
  room_number text not null,
  floor       int,
  capacity    int not null default 2,
  type        room_type not null default 'double',
  amenities   text[] not null default '{}',
  is_occupied bool not null default false,
  unique(hostel_id, room_number)
);

-- ── Room Assignments ──────────────────────────────────────────

create table room_assignments (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  vacated_at  timestamptz,
  is_current  bool not null default true
);

-- Only one active assignment per student
create unique index room_assignments_active_user
  on room_assignments(user_id) where (is_current = true);

-- ── Gate Passes ───────────────────────────────────────────────

create table gate_passes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  hostel_id    uuid not null references hostels(id) on delete cascade,
  qr_token     text unique not null,
  pass_type    pass_type not null,
  status       pass_status not null default 'active',
  generated_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  scanned_at   timestamptz,
  scanned_by   uuid references profiles(id) on delete set null
);

create index gate_passes_user_id_idx    on gate_passes(user_id);
create index gate_passes_hostel_id_idx  on gate_passes(hostel_id);
create index gate_passes_status_idx     on gate_passes(status);
create index gate_passes_generated_idx  on gate_passes(generated_at desc);

-- ── Visitors ──────────────────────────────────────────────────

create table visitors (
  id             uuid primary key default gen_random_uuid(),
  host_user_id   uuid not null references profiles(id) on delete cascade,
  hostel_id      uuid not null references hostels(id) on delete cascade,
  visitor_name   text not null,
  visitor_phone  text not null,
  purpose        text,
  expected_date  date not null,
  expected_time  time,
  pass_expiry    timestamptz,
  status         visitor_status not null default 'pending',
  created_at     timestamptz not null default now()
);

create index visitors_host_user_idx   on visitors(host_user_id);
create index visitors_hostel_idx      on visitors(hostel_id);
create index visitors_expected_date   on visitors(expected_date);

-- ── Mess Menu ─────────────────────────────────────────────────

create table mess_menu (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references hostels(id) on delete cascade,
  date         date not null,
  meal_type    meal_type not null,
  items        text[] not null default '{}',
  created_by   uuid not null references profiles(id) on delete cascade,
  unique(hostel_id, date, meal_type)
);

create index mess_menu_hostel_date_idx on mess_menu(hostel_id, date);

-- ── Mess Rates ────────────────────────────────────────────────

create table mess_rates (
  id               uuid primary key default gen_random_uuid(),
  hostel_id        uuid not null references hostels(id) on delete cascade,
  breakfast_rate   numeric(8,2) not null default 0,
  lunch_rate       numeric(8,2) not null default 0,
  dinner_rate      numeric(8,2) not null default 0,
  effective_from   date not null,
  effective_to     date
);

create index mess_rates_hostel_idx on mess_rates(hostel_id, effective_from desc);

-- ── Mess Optouts ──────────────────────────────────────────────
-- Default: all meals opted IN (true). Row only needed when student changes defaults.

create table mess_optouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  hostel_id  uuid not null references hostels(id) on delete cascade,
  date       date not null,
  breakfast  bool not null default true,
  lunch      bool not null default true,
  dinner     bool not null default true,
  unique(user_id, date)
);

create index mess_optouts_user_idx   on mess_optouts(user_id);
create index mess_optouts_hostel_idx on mess_optouts(hostel_id, date);

-- ── Complaints ────────────────────────────────────────────────

create table complaints (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  hostel_id       uuid not null references hostels(id) on delete cascade,
  category        complaint_category not null,
  title           text not null,
  description     text not null check(char_length(description) >= 20),
  priority        complaint_priority not null default 'medium',
  status          complaint_status not null default 'submitted',
  photos          text[] not null default '{}',
  assigned_to     uuid references profiles(id) on delete set null,
  rating          int check(rating >= 1 and rating <= 5),
  resolution_note text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index complaints_user_idx     on complaints(user_id);
create index complaints_hostel_idx   on complaints(hostel_id);
create index complaints_status_idx   on complaints(status);
create index complaints_priority_idx on complaints(priority);
create index complaints_created_idx  on complaints(created_at desc);

-- ── Complaint Updates (timeline) ─────────────────────────────

create table complaint_updates (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references complaints(id) on delete cascade,
  updated_by    uuid not null references profiles(id) on delete cascade,
  old_status    complaint_status,
  new_status    complaint_status not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index complaint_updates_complaint_idx on complaint_updates(complaint_id, created_at asc);

-- ── Payments ──────────────────────────────────────────────────

create table payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  hostel_id      uuid not null references hostels(id) on delete cascade,
  payment_type   payment_type not null,
  amount         numeric(10,2) not null check(amount > 0),
  due_date       date,
  paid_date      date,
  status         payment_status not null default 'pending',
  description    text,
  reference_id   text,
  created_at     timestamptz not null default now()
);

create index payments_user_idx    on payments(user_id);
create index payments_hostel_idx  on payments(hostel_id);
create index payments_status_idx  on payments(status);
create index payments_due_date    on payments(due_date);

-- ── Announcements ─────────────────────────────────────────────

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  hostel_id  uuid not null references hostels(id) on delete cascade,
  title      text not null,
  content    text not null,
  category   announcement_category not null default 'general',
  is_pinned  bool not null default false,
  posted_by  uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index announcements_hostel_idx on announcements(hostel_id, created_at desc);
create index announcements_pinned_idx on announcements(hostel_id, is_pinned) where is_pinned = true;

-- ── Announcement Reads ────────────────────────────────────────

create table announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key(announcement_id, user_id)
);

-- ── Marketplace Listings ──────────────────────────────────────

create table marketplace_listings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  hostel_id   uuid not null references hostels(id) on delete cascade,
  title       text not null,
  description text,
  price       numeric(10,2) check(price >= 0),
  category    text not null default 'other',
  condition   listing_condition not null default 'good',
  images      text[] not null default '{}',
  status      listing_status not null default 'active',
  created_at  timestamptz not null default now()
);

create index marketplace_hostel_idx  on marketplace_listings(hostel_id, created_at desc);
create index marketplace_status_idx  on marketplace_listings(status) where status = 'active';

-- ── Lost & Found ──────────────────────────────────────────────

create table lost_found (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  hostel_id     uuid not null references hostels(id) on delete cascade,
  type          lostfound_type not null,
  item_name     text not null,
  description   text,
  location      text,
  date_occurred date,
  images        text[] not null default '{}',
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);

create index lost_found_hostel_idx on lost_found(hostel_id, type, created_at desc);

-- ── SOS Incidents ─────────────────────────────────────────────

create table sos_incidents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  hostel_id       uuid not null references hostels(id) on delete cascade,
  location_lat    float8,
  location_lng    float8,
  location_desc   text,
  status          sos_status not null default 'active',
  acknowledged_by uuid references profiles(id) on delete set null,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

create index sos_hostel_idx  on sos_incidents(hostel_id, created_at desc);
create index sos_status_idx  on sos_incidents(status) where status = 'active';

-- ── Notifications ─────────────────────────────────────────────

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb,
  is_read    bool not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx    on notifications(user_id, created_at desc);
create index notifications_unread_idx  on notifications(user_id) where is_read = false;

-- ── Parent Consents ───────────────────────────────────────────

create table parent_consents (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null unique references profiles(id) on delete cascade,
  parent_email  text not null,
  parent_phone  text,
  parent_name   text not null,
  is_active     bool not null default true,
  created_at    timestamptz not null default now()
);

-- ── Push Subscriptions ────────────────────────────────────────

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);

create index push_subs_user_idx on push_subscriptions(user_id);
