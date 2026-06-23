# Gate Pass System Redesign — Trip-Based Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5-minute dynamic QR tokens with a static QR identity + trip-based model that serves as a complete digital register, so hostels can retire the paper sign-out book.

**Architecture:** Each student profile gets a permanent `qr_identity_token` (their digital ID). Students create a "trip" record before leaving (destination + expected return). The guard scans the student's static QR to approve exit and log return. Old `gate_passes` table is kept intact but receives no new writes; all new data goes into `gate_trips`.

**Tech Stack:** React 19, react-router-dom v7, @tanstack/react-query v5, zustand v5, Tailwind CSS v4, TypeScript 6, Vite 8, Supabase JS v2, html5-qrcode (already installed), qrcode.react (already installed).

## Global Constraints

- React 19, react-router-dom v7, @tanstack/react-query v5, Tailwind CSS v4, TypeScript 6 — no new npm packages
- `gate_passes` table and all existing queries against it must remain untouched until Task 7 replaces them — never drop the table
- `npx tsc --noEmit` must pass with 0 errors after every task
- DB migrations applied via `mcp__supabase__apply_migration` (not SQL files alone)
- RLS on every new table — students see their own rows, staff/security see all in their hostel
- `trip_status` enum values: `'pending' | 'out' | 'returned' | 'overdue' | 'cancelled'`
- Static QR encodes `profiles.qr_identity_token` — a UUID, not the user's auth id
- `expected_return_at` is `timestamptz NOT NULL` — always required
- Only one `pending` trip and one `out` trip per student enforced by unique partial indexes
- Auth store selector: `useAuthStore((s) => s.user)` — `user.profile`, `user.hostel`, `user.id`
- Lucide React for icons; `toast` from `sonner`; `@/lib/utils` for `cn`, `formatDate`, `formatTime`, `getInitials`, `getAvatarColor`
- Spec: `docs/superpowers/specs/2026-06-23-gate-pass-redesign.md`

---

### Task 1: DB Migration + TypeScript Types

**Files:**
- Create: `supabase/migrations/014_gate_trips.sql`
- Modify: `src/types/database.types.ts`
- Modify: `src/types/app.types.ts`

**Interfaces:**
- Produces: `trip_status` enum, `trip_scan_result` composite type, `gate_trips` table, `profiles.qr_identity_token`, `hostels.curfew_time`, RPCs `use_trip_exit` / `use_trip_return` / `guard_create_trip` / `mark_overdue_trips`
- Produces: `Database['public']['Tables']['gate_trips']` type, `Database['public']['Enums']['trip_status']`, `Database['public']['Functions']['use_trip_exit' | 'use_trip_return' | 'guard_create_trip']`
- Produces: `GateTrip` type in `app.types.ts`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/014_gate_trips.sql`:

```sql
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
```

- [ ] **Step 2: Apply migration via MCP**

Use `mcp__supabase__apply_migration` with name `014_gate_trips` and the SQL content from the file above.

- [ ] **Step 3: Verify migration applied**

Use `mcp__supabase__execute_sql` to confirm:
```sql
select column_name from information_schema.columns
where table_name = 'gate_trips'
order by ordinal_position;
```
Expected: id, user_id, hostel_id, destination, purpose, expected_return_at, exit_at, exit_approved_by, return_at, return_logged_by, status, linked_leave_id, guard_notes, created_at, updated_at

```sql
select column_name from information_schema.columns
where table_name = 'profiles' and column_name = 'qr_identity_token';
```
Expected: 1 row

- [ ] **Step 4: Update `src/types/database.types.ts`**

Add the `trip_status` enum to the `Enums` section (alphabetically with other enums):

```typescript
trip_status: "cancelled" | "out" | "overdue" | "pending" | "returned"
```

Add `gate_trips` table to the `Tables` section (alphabetically between `gate_passes` and `hostels`):

```typescript
gate_trips: {
  Row: {
    created_at: string
    destination: string
    exit_approved_by: string | null
    exit_at: string | null
    expected_return_at: string
    guard_notes: string | null
    hostel_id: string
    id: string
    linked_leave_id: string | null
    purpose: string | null
    return_at: string | null
    return_logged_by: string | null
    status: Database["public"]["Enums"]["trip_status"]
    updated_at: string
    user_id: string
  }
  Insert: {
    created_at?: string
    destination: string
    exit_approved_by?: string | null
    exit_at?: string | null
    expected_return_at: string
    guard_notes?: string | null
    hostel_id: string
    id?: string
    linked_leave_id?: string | null
    purpose?: string | null
    return_at?: string | null
    return_logged_by?: string | null
    status?: Database["public"]["Enums"]["trip_status"]
    updated_at?: string
    user_id: string
  }
  Update: {
    created_at?: string
    destination?: string
    exit_approved_by?: string | null
    exit_at?: string | null
    expected_return_at?: string
    guard_notes?: string | null
    hostel_id?: string
    id?: string
    linked_leave_id?: string | null
    purpose?: string | null
    return_at?: string | null
    return_logged_by?: string | null
    status?: Database["public"]["Enums"]["trip_status"]
    updated_at?: string
    user_id?: string
  }
  Relationships: [
    {
      foreignKeyName: "gate_trips_exit_approved_by_fkey"
      columns: ["exit_approved_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "gate_trips_hostel_id_fkey"
      columns: ["hostel_id"]
      isOneToOne: false
      referencedRelation: "hostels"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "gate_trips_linked_leave_id_fkey"
      columns: ["linked_leave_id"]
      isOneToOne: false
      referencedRelation: "leave_requests"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "gate_trips_return_logged_by_fkey"
      columns: ["return_logged_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "gate_trips_user_id_fkey"
      columns: ["user_id"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },
  ]
}
```

Add `qr_identity_token: string` to `profiles.Row` (not null — always present after migration).
Add `qr_identity_token?: string` to `profiles.Insert` and `profiles.Update`.

Add `curfew_time: string | null` to `hostels.Row`.
Add `curfew_time?: string | null` to `hostels.Insert` and `hostels.Update`.

Add the scan RPCs to the `Functions` section:

```typescript
guard_create_trip: {
  Args: {
    p_user_id: string
    p_destination: string
    p_expected_return_at: string
    p_purpose?: string
  }
  Returns: string
}
mark_overdue_trips: {
  Args: Record<PropertyKey, never>
  Returns: undefined
}
use_trip_exit: {
  Args: { p_qr_token: string; p_guard_notes?: string }
  Returns: {
    trip_id: string
    student_name: string
    room_number: string | null
    destination: string
    purpose: string | null
    expected_return_at: string
    exit_at: string
    linked_leave_id: string | null
    duration_minutes: number | null
  }
}
use_trip_return: {
  Args: { p_qr_token: string; p_guard_notes?: string }
  Returns: {
    trip_id: string
    student_name: string
    room_number: string | null
    destination: string
    purpose: string | null
    expected_return_at: string
    exit_at: string
    linked_leave_id: string | null
    duration_minutes: number
  }
}
```

- [ ] **Step 5: Update `src/types/app.types.ts`**

Add `GateTrip` export:

```typescript
export type GateTrip = Database['public']['Tables']['gate_trips']['Row']
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/014_gate_trips.sql src/types/database.types.ts src/types/app.types.ts
git commit -m "feat: add gate_trips table, qr_identity_token on profiles, curfew_time on hostels"
```

---

### Task 2: gateTrip.service.ts

**Files:**
- Create: `src/services/gateTrip.service.ts`

**Interfaces:**
- Consumes: `GateTrip` from `@/types/app.types`, `Database` from `@/types/database.types`, supabase client
- Produces (all consumed by Tasks 3, 4, 5, 6, 7):
  - `TripScanResult` type
  - `GateTripWithProfile` type
  - `getActiveTripForStudent(userId: string): Promise<GateTrip | null>`
  - `getMyTrips(userId: string, limit?: number): Promise<GateTrip[]>`
  - `createTrip(params): Promise<GateTrip>`
  - `cancelTrip(tripId: string): Promise<void>`
  - `getStudentByQrToken(token: string): Promise<{ student: Profile; activeTrip: GateTrip | null } | null>`
  - `useTripExit(qrToken: string, guardNotes?: string): Promise<TripScanResult>`
  - `useTripReturn(qrToken: string, guardNotes?: string): Promise<TripScanResult>`
  - `guardCreateTrip(params): Promise<string>`
  - `getTripsCurrentlyOut(hostelId: string): Promise<GateTripWithProfile[]>`
  - `getTodaysTripLog(hostelId: string): Promise<GateTripWithProfile[]>`

- [ ] **Step 1: Create the service file**

Create `src/services/gateTrip.service.ts`:

```typescript
import { supabase } from '@/lib/supabase'
import type { GateTrip, Profile } from '@/types/app.types'

export type TripScanResult = {
  trip_id: string
  student_name: string
  room_number: string | null
  destination: string
  purpose: string | null
  expected_return_at: string
  exit_at: string
  linked_leave_id: string | null
  duration_minutes: number | null
}

export type GateTripWithProfile = GateTrip & {
  profiles: { full_name: string; room_number: string | null; avatar_url: string | null } | null
}

// ── Student functions ─────────────────────────────────────────

export async function getActiveTripForStudent(userId: string): Promise<GateTrip | null> {
  const { data } = await supabase
    .from('gate_trips')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'out', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getMyTrips(userId: string, limit = 20): Promise<GateTrip[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function createTrip(params: {
  userId: string
  hostelId: string
  destination: string
  purpose?: string
  expectedReturnAt: string
}): Promise<GateTrip> {
  const { data, error } = await supabase
    .from('gate_trips')
    .insert({
      user_id:            params.userId,
      hostel_id:          params.hostelId,
      destination:        params.destination,
      purpose:            params.purpose ?? null,
      expected_return_at: params.expectedReturnAt,
      status:             'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('gate_trips')
    .update({ status: 'cancelled' })
    .eq('id', tripId)
    .eq('status', 'pending')
  if (error) throw error
}

// ── Scanner / guard functions ─────────────────────────────────

export async function getStudentByQrToken(
  token: string,
): Promise<{ student: Profile; activeTrip: GateTrip | null } | null> {
  const { data: student, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('qr_identity_token', token)
    .maybeSingle()

  if (error || !student) return null

  const { data: trip } = await supabase
    .from('gate_trips')
    .select('*')
    .eq('user_id', student.id)
    .in('status', ['pending', 'out', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { student: student as Profile, activeTrip: trip }
}

export async function useTripExit(
  qrToken: string,
  guardNotes?: string,
): Promise<TripScanResult> {
  const { data, error } = await supabase.rpc('use_trip_exit', {
    p_qr_token:    qrToken,
    p_guard_notes: guardNotes ?? null,
  })
  if (error) throw error
  return data as TripScanResult
}

export async function useTripReturn(
  qrToken: string,
  guardNotes?: string,
): Promise<TripScanResult> {
  const { data, error } = await supabase.rpc('use_trip_return', {
    p_qr_token:    qrToken,
    p_guard_notes: guardNotes ?? null,
  })
  if (error) throw error
  return data as TripScanResult
}

export async function guardCreateTrip(params: {
  userId: string
  destination: string
  expectedReturnAt: string
  purpose?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('guard_create_trip', {
    p_user_id:            params.userId,
    p_destination:        params.destination,
    p_expected_return_at: params.expectedReturnAt,
    p_purpose:            params.purpose ?? null,
  })
  if (error) throw error
  return data as string
}

// ── Manager / warden functions ────────────────────────────────

export async function getTripsCurrentlyOut(hostelId: string): Promise<GateTripWithProfile[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('*, profiles(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .in('status', ['out', 'overdue'])
    .order('exit_at', { ascending: false })
  return (data ?? []) as GateTripWithProfile[]
}

export async function getTodaysTripLog(hostelId: string): Promise<GateTripWithProfile[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('gate_trips')
    .select('*, profiles(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .gte('exit_at', today)
    .not('exit_at', 'is', null)
    .order('exit_at', { ascending: false })
  return (data ?? []) as GateTripWithProfile[]
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/services/gateTrip.service.ts
git commit -m "feat: add gateTrip.service.ts with student, scanner, and manager functions"
```

---

### Task 3: Student GatePassPage + useGateTrip Hook

**Files:**
- Create: `src/features/gate-pass/hooks/useGateTrip.ts`
- Modify: `src/features/gate-pass/pages/GatePassPage.tsx`

**Interfaces:**
- Consumes: `getActiveTripForStudent`, `getMyTrips`, `createTrip`, `cancelTrip` from `@/services/gateTrip.service`
- Consumes: `user.profile.qr_identity_token` from auth store (static QR value)
- Produces: `useGateTrip()` hook consumed by `GatePassPage` and `PassHistoryPage`

The existing `useGatePass.ts` hook is **not deleted** — `PassHistoryPage` still imports it until Task 4.

- [ ] **Step 1: Create `useGateTrip.ts`**

Create `src/features/gate-pass/hooks/useGateTrip.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import {
  getActiveTripForStudent,
  getMyTrips,
  createTrip,
  cancelTrip,
} from '@/services/gateTrip.service'

export function useGateTrip() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const { data: activeTrip, isLoading: tripLoading } = useQuery({
    queryKey: ['active-trip', userId],
    queryFn:  () => getActiveTripForStudent(userId),
    enabled:  !!userId,
    refetchInterval: 30_000,
  })

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['my-trips', userId],
    queryFn:  () => getMyTrips(userId),
    enabled:  !!userId,
  })

  const { mutate: submitTrip, isPending: submitting } = useMutation({
    mutationFn: (params: { destination: string; purpose?: string; expectedReturnAt: string }) =>
      createTrip({ userId, hostelId, ...params }),
    onSuccess: () => {
      toast.success('Trip request submitted — show your QR at the gate')
      qc.invalidateQueries({ queryKey: ['active-trip', userId] })
      qc.invalidateQueries({ queryKey: ['my-trips', userId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: (tripId: string) => cancelTrip(tripId),
    onSuccess: () => {
      toast.success('Trip request cancelled')
      qc.invalidateQueries({ queryKey: ['active-trip', userId] })
      qc.invalidateQueries({ queryKey: ['my-trips', userId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    activeTrip,
    tripLoading,
    trips,
    tripsLoading,
    submitting,
    cancelling,
    submitTrip,
    cancel,
    hostelLinked: !!hostelId,
    qrToken: user?.profile.qr_identity_token ?? '',
  }
}
```

- [ ] **Step 2: Rewrite `GatePassPage.tsx`**

Replace the file at `src/features/gate-pass/pages/GatePassPage.tsx` with the following.
The `VisitorTab` component and all visitor-related imports are kept exactly as they are in the
original — copy them verbatim from the existing file. Only the `'my'` tab content changes.

Key structure of the new file:

```typescript
import { useState } from 'react'
import { Bell, LogIn, LogOut, Clock, DoorOpen, ChevronRight, UserPlus,
         Phone, Trash2, CalendarDays, MapPin, Loader2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useGateTrip } from '../hooks/useGateTrip'
import { getInitials, getAvatarColor, formatTime, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { getVisitors, createVisitor, cancelVisitor } from '@/services/visitors.service'

type Tab = 'my' | 'visitor'

// ── Return time preset helpers ────────────────────────────────

function getPresetTime(preset: '2h' | 'evening' | 'tonight' | 'tomorrow'): string {
  const d = new Date()
  if (preset === '2h') {
    d.setHours(d.getHours() + 2)
  } else if (preset === 'evening') {
    d.setHours(20, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1) // push to tomorrow if already past
  } else if (preset === 'tonight') {
    d.setHours(22, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
  } else {
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
  }
  // Return as local datetime-local string (YYYY-MM-DDTHH:mm)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Waiting at Gate',
  out:       'Currently Outside',
  overdue:   'Overdue',
  returned:  'Returned',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-warning-light text-warning',
  out:       'bg-primary-light text-primary',
  overdue:   'bg-danger-light text-danger',
  returned:  'bg-success-light text-success',
  cancelled: 'bg-surface-raised text-text-tertiary',
}

export default function GatePassPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('my')
  const user = useAuthStore((s) => s.user)
  const { activeTrip, tripLoading, trips, tripsLoading, submitting, cancelling, submitTrip, cancel, qrToken } = useGateTrip()

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const hostelName  = user?.hostel?.name?.split(' ')[0] ?? 'Block'
  const roomLabel   = user?.profile.room_number
    ? `${hostelName} · Room ${user.profile.room_number}`
    : user?.hostel?.name ?? 'Ashiyaan'

  return (
    <div className="min-h-dvh bg-canvas pb-24">

      {/* ── TopBar ── */}
      <div className="bg-surface px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
            style={{ backgroundColor: avatarColor }}>
            {initials}
          </div>
          <div>
            <p className="text-[16px] font-bold text-primary leading-tight">{roomLabel}</p>
            <p className="text-[12px] text-text-tertiary leading-tight">{user?.profile.full_name}</p>
          </div>
        </div>
        <button onClick={() => navigate('/notifications')} className="p-2 rounded-full hover:bg-surface-raised">
          <Bell size={22} className="text-text-secondary" />
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── Tabs ── */}
        <div className="flex bg-surface-raised rounded-inner p-1">
          {(['my', 'visitor'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${
                tab === t ? 'bg-surface text-primary shadow-card' : 'text-text-tertiary'
              }`}>
              {t === 'my' ? 'My Gate Pass' : 'Visitor Passes'}
            </button>
          ))}
        </div>

        {tab === 'my' ? (
          <MyGatePassTab
            user={user}
            qrToken={qrToken}
            activeTrip={activeTrip}
            tripLoading={tripLoading}
            trips={trips}
            tripsLoading={tripsLoading}
            submitting={submitting}
            cancelling={cancelling}
            submitTrip={submitTrip}
            cancelTrip={cancel}
            navigate={navigate}
          />
        ) : (
          <VisitorTab userId={user?.id ?? ''} hostelId={user?.profile.hostel_id ?? ''} />
        )}

      </div>
    </div>
  )
}
```

The `MyGatePassTab` component (in the same file) receives props and renders:

1. **Static QR card** — always shown:
```typescript
<div className="bg-surface rounded-card shadow-card overflow-hidden">
  <div className="px-5 pt-5 pb-3">
    <p className="text-[17px] font-bold text-text-primary">Digital Gate Pass</p>
    <p className="text-[13px] text-text-tertiary mt-0.5">Show this QR at the gate</p>
  </div>
  {/* QR on teal background */}
  <div className="mx-5 mb-4 bg-primary rounded-inner p-6 flex items-center justify-center">
    {qrToken ? (
      <div className="bg-white rounded-[16px] p-3 shadow-raised">
        <QRCodeSVG value={qrToken} size={180} level="M" fgColor="#1A3D3D" bgColor="#FFFFFF" />
      </div>
    ) : (
      <div className="bg-white/10 rounded-inner flex items-center justify-center w-[180px] h-[180px]">
        <DoorOpen size={40} className="text-white/50" />
      </div>
    )}
  </div>
  {/* Student + room chips */}
  {user && (
    <div className="mx-5 mb-5 grid grid-cols-2 gap-3">
      <div className="bg-surface-raised rounded-inner px-3 py-2">
        <p className="text-[11px] text-text-tertiary mb-0.5">Student</p>
        <p className="text-[13px] font-semibold text-text-primary truncate">{user.profile.full_name}</p>
      </div>
      <div className="bg-surface-raised rounded-inner px-3 py-2">
        <p className="text-[11px] text-text-tertiary mb-0.5">Room</p>
        <p className="text-[13px] font-semibold text-text-primary">{user.profile.room_number ?? '—'}</p>
      </div>
    </div>
  )}
</div>
```

2. **Active trip status card** (shown if `activeTrip` exists and status is `pending`, `out`, or `overdue`):
   - Shows `STATUS_LABEL[activeTrip.status]` badge, destination with MapPin icon, expected return with Clock icon
   - If `pending`: "Waiting for guard to scan your QR at the gate" + Cancel button
   - If `out` or `overdue`: shows exit time, overdue badge if `overdue`

3. **Create trip form** (shown only if no active trip):

```typescript
// State in MyGatePassTab:
const [destination, setDestination] = useState('')
const [purpose, setPurpose] = useState('')
const [expectedReturn, setExpectedReturn] = useState('')
const [showCustomTime, setShowCustomTime] = useState(false)

// Presets:
const presets = [
  { label: '2 hrs',      value: '2h' },
  { label: 'Evening',    value: 'evening' },
  { label: 'Tonight',    value: 'tonight' },
  { label: 'Tomorrow',   value: 'tomorrow' },
] as const

function handlePreset(p: typeof presets[number]['value']) {
  setExpectedReturn(getPresetTime(p))
  setShowCustomTime(false)
}

function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (!destination.trim()) { toast.error('Destination is required'); return }
  if (!expectedReturn) { toast.error('Select a return time'); return }
  submitTrip({
    destination: destination.trim(),
    purpose: purpose.trim() || undefined,
    expectedReturnAt: new Date(expectedReturn).toISOString(),
  })
  setDestination(''); setPurpose(''); setExpectedReturn('')
}
```

Form JSX:
```typescript
<div className="bg-surface rounded-card shadow-card p-5 space-y-4">
  <p className="text-[17px] font-bold text-text-primary">Plan Your Outing</p>
  <form onSubmit={handleSubmit} className="space-y-4">
    <Input
      label="Destination"
      placeholder="e.g. City Mall, Home, College"
      value={destination}
      onChange={(e) => setDestination(e.target.value)}
      leftIcon={<MapPin size={14} />}
      required
    />
    <Input
      label="Purpose (optional)"
      placeholder="e.g. Shopping, Family visit"
      value={purpose}
      onChange={(e) => setPurpose(e.target.value)}
    />
    <div>
      <p className="text-[13px] font-medium text-text-secondary mb-2">Expected return</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
              expectedReturn === getPresetTime(p.value)
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-border text-text-secondary'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustomTime((v) => !v)}
          className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
            showCustomTime ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary'
          }`}
        >
          Custom
        </button>
      </div>
      {showCustomTime && (
        <input
          type="datetime-local"
          value={expectedReturn}
          onChange={(e) => setExpectedReturn(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full border border-border rounded-inner px-3 py-2 text-[14px] text-text-primary bg-surface"
        />
      )}
      {expectedReturn && !showCustomTime && (
        <p className="text-[12px] text-text-tertiary">
          Return by: {formatDate(new Date(expectedReturn), { day: '2-digit', month: 'short' })}, {formatTime(new Date(expectedReturn))}
        </p>
      )}
    </div>
    <Button type="submit" variant="dark" fullWidth loading={submitting}
      leftIcon={<LogOut size={16} />}>
      Submit Trip Request
    </Button>
  </form>
</div>
```

4. **Recent trips** (last 3 from `trips`, with "View all" link):

```typescript
{!tripsLoading && trips.length > 0 && (
  <div>
    <div className="flex items-center justify-between mb-3">
      <p className="text-[17px] font-bold text-text-primary">Recent Trips</p>
      <button onClick={() => navigate('/gate-pass/history')}
        className="text-[13px] text-primary font-semibold flex items-center gap-0.5">
        View All <ChevronRight size={14} />
      </button>
    </div>
    <div className="space-y-2">
      {trips.filter(t => t.status !== 'pending').slice(0, 3).map((trip) => (
        <div key={trip.id} className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary truncate">{trip.destination}</p>
            <p className="text-[12px] text-text-tertiary">
              {formatDate(trip.created_at, { day: '2-digit', month: 'short' })}
              {trip.exit_at ? ` · Out: ${formatTime(trip.exit_at)}` : ''}
              {trip.return_at ? ` · In: ${formatTime(trip.return_at)}` : ''}
            </p>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill flex-shrink-0 ${STATUS_COLOR[trip.status] ?? 'bg-surface-raised text-text-tertiary'}`}>
            {STATUS_LABEL[trip.status] ?? trip.status}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

The `VisitorTab` component and all visitor service imports remain **exactly** as they are in the current file — copy them verbatim.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Smoke test in browser**

```bash
npm run dev
```

Verify:
- `/gate-pass` shows "My Gate Pass" tab with static QR (always visible — not a countdown QR)
- "Plan Your Outing" form shows when no pending/out trip
- Preset buttons set the expected return time correctly
- Submitting a trip shows "Trip request submitted" toast and switches to active-trip card
- Cancel button removes the pending trip
- Visitor Passes tab still works exactly as before

- [ ] **Step 5: Commit**

```bash
git add src/features/gate-pass/hooks/useGateTrip.ts src/features/gate-pass/pages/GatePassPage.tsx
git commit -m "feat: rework gate pass page with static QR and trip creation form"
```

---

### Task 4: TripHistoryPage

**Files:**
- Modify: `src/features/gate-pass/pages/PassHistoryPage.tsx` (complete rewrite — keep same file path and default export name)

**Interfaces:**
- Consumes: `getMyTrips` from `@/services/gateTrip.service`
- Consumes: `useAuthStore`

Note: `useGatePass` hook is no longer imported after this task — Task 3 already added `useGateTrip`, and this task removes the last reference to the old hook in the gate-pass feature. **Do NOT delete `useGatePass.ts`** itself yet — it may be referenced elsewhere.

- [ ] **Step 1: Rewrite `PassHistoryPage.tsx`**

```typescript
import { MapPin, ArrowRight, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { getMyTrips } from '@/services/gateTrip.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatTime } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-warning-light text-warning',
  out:       'bg-primary-light text-primary',
  overdue:   'bg-danger-light text-danger',
  returned:  'bg-success-light text-success',
  cancelled: 'bg-surface-raised text-text-tertiary',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  out:       'Outside',
  overdue:   'Overdue',
  returned:  'Returned',
  cancelled: 'Cancelled',
}

function formatDuration(exitAt: string, returnAt: string): string {
  const mins = Math.round((new Date(returnAt).getTime() - new Date(exitAt).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function PassHistoryPage() {
  const user   = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['my-trips', userId],
    queryFn:  () => getMyTrips(userId, 50),
    enabled:  !!userId,
  })

  // Group by date (using exit_at date, or created_at if not yet out)
  const grouped = trips.reduce<Record<string, typeof trips>>((acc, trip) => {
    const d = trip.exit_at ?? trip.created_at
    const date = formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' })
    if (!acc[date]) acc[date] = []
    acc[date].push(trip)
    return acc
  }, {})

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Trip History" showBack />
      <div className="px-4 pt-16 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                <div className="flex-1"><Skeleton lines={2} /></div>
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState
            icon={<MapPin size={28} />}
            title="No trips yet"
            description="Your gate pass trips will appear here"
          />
        ) : (
          Object.entries(grouped).map(([date, dayTrips]) => (
            <div key={date}>
              <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">
                {date}
              </p>
              <div className="space-y-2">
                {dayTrips.map((trip) => (
                  <div key={trip.id} className="bg-surface rounded-card px-4 py-3 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">{trip.destination}</p>
                        {trip.purpose && (
                          <p className="text-[12px] text-text-tertiary italic">{trip.purpose}</p>
                        )}
                        {/* Times row */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {trip.exit_at ? (
                            <>
                              <span className="text-[12px] text-text-tertiary">Out: {formatTime(trip.exit_at)}</span>
                              {trip.return_at ? (
                                <>
                                  <ArrowRight size={10} className="text-text-tertiary" />
                                  <span className="text-[12px] text-text-tertiary">In: {formatTime(trip.return_at)}</span>
                                  <span className="text-[11px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-pill">
                                    {formatDuration(trip.exit_at, trip.return_at)}
                                  </span>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[12px] text-text-tertiary">
                              Created: {formatTime(trip.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill flex-shrink-0 ${STATUS_COLOR[trip.status] ?? ''}`}>
                        {STATUS_LABEL[trip.status] ?? trip.status}
                      </span>
                    </div>
                    {trip.status === 'overdue' && (
                      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-danger">
                        <AlertCircle size={12} />
                        Expected by {formatTime(trip.expected_return_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Navigate to `/gate-pass/history`. Verify trips are shown with destination, out/in times, duration, and status badge. Grouped by date.

- [ ] **Step 4: Commit**

```bash
git add src/features/gate-pass/pages/PassHistoryPage.tsx
git commit -m "feat: rewrite PassHistoryPage to show trip history with destination, times, and duration"
```

---

### Task 5: ScanPage + QRScanner Overhaul + Curfew/Leave Integration

**Files:**
- Modify: `src/features/gate-pass/components/QRScanner.tsx` (simplify to raw token emitter)
- Modify: `src/features/gate-pass/pages/ScanPage.tsx` (full rewrite — trip scan state machine)

**Interfaces:**
- Consumes: `getStudentByQrToken`, `useTripExit`, `useTripReturn`, `guardCreateTrip` from `@/services/gateTrip.service`
- Consumes: `user.hostel.curfew_time` from auth store (for curfew warning)
- `QRScanner` props: `onScan: (token: string) => void; active: boolean` — the component just runs the camera and calls `onScan` with the decoded string
- `ScanPage` owns all state and trip logic

**Curfew check:** After `getStudentByQrToken` resolves with a pending trip, before calling `useTripExit`, check if `hostel.curfew_time` is set and if current local time is past it. If yes and trip has no `linked_leave_id`, show a yellow warning banner. Guard must tap "Confirm Override" to proceed.

**Leave badge:** During student lookup, also query `leave_requests` for an approved leave covering today. If found, show a green badge "Approved Leave: [destination] until [to_date]" on the scan result screen.

- [ ] **Step 1: Simplify `QRScanner.tsx`**

Replace the entire file with a camera component that emits the decoded token string:

```typescript
import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QRScannerProps {
  active: boolean
  onScan: (token: string) => void
  onError?: (message: string) => void
}

export function QRScanner({ active, onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (active && !started) {
      const qr = new Html5Qrcode('qr-reader')
      scannerRef.current = qr
      qr.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (token) => { onScan(token) },
        () => {},
      ).then(() => setStarted(true))
        .catch(() => {
          onError?.('Camera access denied. Please allow camera permission and try again.')
        })
    }
    if (!active && started) {
      scannerRef.current?.stop().catch(() => {})
      setStarted(false)
    }
  }, [active, started, onScan, onError])

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}) }
  }, [])

  return (
    <div className="relative w-full max-w-sm">
      <div id="qr-reader" className={cn('w-full rounded-card overflow-hidden bg-black', started ? 'h-72' : 'h-0')} />
      {started && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-52 h-52 relative">
            {(['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const).map((pos, i) => (
              <div key={i} className={`absolute w-8 h-8 border-primary border-[3px] ${pos} ${
                i === 0 ? 'rounded-tl-sm border-r-0 border-b-0' :
                i === 1 ? 'rounded-tr-sm border-l-0 border-b-0' :
                i === 2 ? 'rounded-bl-sm border-r-0 border-t-0' :
                           'rounded-br-sm border-l-0 border-t-0'}`} />
            ))}
            <div className="absolute left-2 right-2 h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `ScanPage.tsx`**

The page manages the full scan state machine. State type:

```typescript
type ScanPhase =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'processing' }
  | { type: 'loaded'; student: Profile; activeTrip: GateTrip | null; approvedLeave: LeaveRow | null }
  | { type: 'curfew_warn'; student: Profile; trip: GateTrip; approvedLeave: LeaveRow | null }
  | { type: 'guard_create'; student: Profile }
  | { type: 'success'; result: TripScanResult; action: 'exit' | 'return' | 'created' }
  | { type: 'error'; message: string }
```

Where `LeaveRow` is: `{ id: string; destination: string | null; to_date: string }`.

Full `ScanPage.tsx` implementation:

```typescript
import { useState, useCallback } from 'react'
import { CheckCircle2, XCircle, ScanLine, AlertTriangle, MapPin, Clock, ChevronRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QRScanner } from '../components/QRScanner'
import { getStudentByQrToken, useTripExit, useTripReturn, guardCreateTrip } from '@/services/gateTrip.service'
import type { TripScanResult } from '@/services/gateTrip.service'
import type { GateTrip, Profile } from '@/types/app.types'
import { formatDate, formatTime, cn } from '@/lib/utils'

type LeaveRow = { id: string; destination: string | null; to_date: string }

type ScanPhase =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'processing' }
  | { type: 'loaded'; student: Profile; activeTrip: GateTrip | null; approvedLeave: LeaveRow | null }
  | { type: 'curfew_warn'; student: Profile; trip: GateTrip; approvedLeave: LeaveRow | null }
  | { type: 'guard_create'; student: Profile }
  | { type: 'success'; result: TripScanResult; action: 'exit' | 'return' | 'created' }
  | { type: 'error'; message: string }

// ── Helpers ───────────────────────────────────────────────────

function getPresetTime(preset: '2h' | 'evening' | 'tonight' | 'tomorrow'): string {
  const d = new Date()
  if (preset === '2h') d.setHours(d.getHours() + 2)
  else if (preset === 'evening') { d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1) }
  else if (preset === 'tonight') { d.setHours(22, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1) }
  else { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0) }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isPastCurfew(curfewTime: string | null | undefined): boolean {
  if (!curfewTime) return false
  const now = new Date()
  const [h, m] = curfewTime.split(':').map(Number)
  const curfew = new Date()
  curfew.setHours(h, m, 0, 0)
  return now >= curfew
}

function formatCurfew(curfewTime: string): string {
  const [h, m] = curfewTime.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return formatTime(d)
}

// ── Main component ────────────────────────────────────────────

export default function ScanPage() {
  const user    = useAuthStore((s) => s.user)
  const hostel  = user?.hostel
  const [phase, setPhase] = useState<ScanPhase>({ type: 'idle' })
  const [cameraError, setCameraError] = useState('')
  const [guardCreateForm, setGuardCreateForm] = useState({
    destination: '', purpose: '', expectedReturn: '', showCustom: false,
  })

  // ── Scan handler ─────────────────────────────────────────────
  const handleScan = useCallback(async (token: string) => {
    if (phase.type !== 'scanning') return
    setPhase({ type: 'processing' })

    try {
      const result = await getStudentByQrToken(token)
      if (!result) { setPhase({ type: 'error', message: 'Student not found — this QR is not registered.' }); return }

      const { student, activeTrip } = result

      // Check for approved leave covering today
      const today = new Date().toISOString().split('T')[0]
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('id, destination, to_date')
        .eq('user_id', student.id)
        .eq('status', 'approved')
        .lte('from_date', today)
        .gte('to_date', today)
        .limit(1)
        .maybeSingle()
      const approvedLeave = leaveData as LeaveRow | null

      setPhase({ type: 'loaded', student, activeTrip, approvedLeave })
    } catch {
      setPhase({ type: 'error', message: 'Failed to look up student. Try again.' })
    }
  }, [phase.type])

  // ── Approve exit ─────────────────────────────────────────────
  async function handleApproveExit(student: Profile, trip: GateTrip, approvedLeave: LeaveRow | null) {
    // Curfew check (only for non-leave trips)
    if (!approvedLeave && isPastCurfew(hostel?.curfew_time)) {
      setPhase({ type: 'curfew_warn', student, trip, approvedLeave })
      return
    }
    await doApproveExit(trip)
  }

  async function doApproveExit(trip: GateTrip) {
    setPhase({ type: 'processing' })
    try {
      const result = await useTripExit(trip.user_id.toString())
      // Note: useTripExit takes qr_token — we need to pass the student's qr token
      // This is done by storing it during the lookup phase; see revised flow below
      setPhase({ type: 'success', result, action: 'exit' })
    } catch (e) {
      setPhase({ type: 'error', message: (e as Error).message })
    }
  }

  // ...
}
```

**Important implementation note for the implementer:** The `useTripExit` and `useTripReturn` RPCs take `p_qr_token` (the student's `qr_identity_token`), not the student's user ID. Store the scanned QR token in a `useRef` during `handleScan` so it's available when the guard taps "Approve Exit" or "Log Return". Revise `phase.loaded` to also carry `scannedToken: string`.

Full revised state type:

```typescript
type ScanPhase =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'processing' }
  | { type: 'loaded'; student: Profile; activeTrip: GateTrip | null; approvedLeave: LeaveRow | null; scannedToken: string }
  | { type: 'curfew_warn'; student: Profile; trip: GateTrip; approvedLeave: LeaveRow | null; scannedToken: string }
  | { type: 'guard_create'; student: Profile }
  | { type: 'success'; result: TripScanResult; action: 'exit' | 'return' | 'created' }
  | { type: 'error'; message: string }
```

The approve-exit function becomes:

```typescript
async function doApproveExit(scannedToken: string) {
  setPhase({ type: 'processing' })
  try {
    const result = await useTripExit(scannedToken)
    setPhase({ type: 'success', result, action: 'exit' })
  } catch (e) {
    setPhase({ type: 'error', message: (e as Error).message })
  }
}

async function doLogReturn(scannedToken: string) {
  setPhase({ type: 'processing' })
  try {
    const result = await useTripReturn(scannedToken)
    setPhase({ type: 'success', result, action: 'return' })
  } catch (e) {
    setPhase({ type: 'error', message: (e as Error).message })
  }
}
```

**Guard-initiated trip creation:**

```typescript
async function doGuardCreate(student: Profile) {
  if (!guardCreateForm.destination.trim() || !guardCreateForm.expectedReturn) {
    toast.error('Destination and return time are required'); return
  }
  setPhase({ type: 'processing' })
  try {
    const tripId = await guardCreateTrip({
      userId: student.id,
      destination: guardCreateForm.destination.trim(),
      purpose: guardCreateForm.purpose.trim() || undefined,
      expectedReturnAt: new Date(guardCreateForm.expectedReturn).toISOString(),
    })
    // Build a minimal TripScanResult for the success screen
    const result: TripScanResult = {
      trip_id: tripId,
      student_name: student.full_name,
      room_number: student.room_number,
      destination: guardCreateForm.destination.trim(),
      purpose: guardCreateForm.purpose.trim() || null,
      expected_return_at: new Date(guardCreateForm.expectedReturn).toISOString(),
      exit_at: new Date().toISOString(),
      linked_leave_id: null,
      duration_minutes: null,
    }
    setPhase({ type: 'success', result, action: 'created' })
    setGuardCreateForm({ destination: '', purpose: '', expectedReturn: '', showCustom: false })
  } catch (e) {
    setPhase({ type: 'error', message: (e as Error).message })
  }
}
```

**Rendered UI per phase:**

- `idle`: large ScanLine icon, "Scan Gate Pass" heading, "Start Scanning" button
- `scanning`: `<QRScanner active={true} onScan={handleScan} onError={...} />` + Cancel
- `processing`: spinner + "Processing..."
- `loaded` — student has `pending` trip: show student card (name, room, avatar), trip details (destination, expected return), approved leave badge if present, "Approve Exit" button (green)
- `loaded` — student has `out` trip: show student card, "Student is currently OUTSIDE since [exit_at]", "Log Return" button (blue)
- `loaded` — no active trip: show student card + "No pending trip" message + "Create Trip" button (navigate to `guard_create` phase)
- `curfew_warn`: yellow warning card "Past curfew ([time]). No approved leave on record.", student info, "Confirm Override & Approve Exit" button + "Cancel" button
- `guard_create`: student name at top, minimal form (destination required, expected return presets), "Log Exit & Create Trip" button
- `success` (exit): green success card showing student name, room, destination, expected return
- `success` (return): green success card showing student name, duration outside
- `success` (created): green success card showing student name, destination, guard created
- `error`: red card with error message + "Try Again" button

All `success` phases show a "Scan Next" button that resets to `idle`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Test manually with dev server**

```bash
npm run dev
```

Verify as a staff/security user:
- `/scan` shows idle screen → "Start Scanning" starts camera
- Scanning a student QR shows their info and pending trip (or "no pending trip")
- "Approve Exit" approves and shows success screen
- "Log Return" closes the trip and shows duration
- "Create Trip" form creates a guard-initiated trip
- "Scan Next" resets to idle
- If past a mock curfew time (temporarily set `hostel.curfew_time` in DB), warning shows

- [ ] **Step 5: Commit**

```bash
git add src/features/gate-pass/components/QRScanner.tsx src/features/gate-pass/pages/ScanPage.tsx
git commit -m "feat: overhaul scanner with trip state machine, guard-initiated trips, curfew warning, leave badge"
```

---

### Task 6: GateDashboardPage + Router + Manager Card

**Files:**
- Create: `src/features/gate-pass/pages/GateDashboardPage.tsx`
- Modify: `src/router.tsx` (add `/manager/gate` route + lazy import)
- Modify: `src/features/dashboard/pages/ManagerDashboardPage.tsx` (add Gate Register card)

**Interfaces:**
- Consumes: `getTripsCurrentlyOut`, `getTodaysTripLog` from `@/services/gateTrip.service`
- Route: `/manager/gate` inside `StaffOnlyGuard`
- Manager dashboard card: navigates to `/manager/gate`

- [ ] **Step 1: Create `GateDashboardPage.tsx`**

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Clock, AlertCircle, ArrowRight, Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getTripsCurrentlyOut, getTodaysTripLog } from '@/services/gateTrip.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { getInitials, getAvatarColor, formatTime, formatDate } from '@/lib/utils'
import type { GateTripWithProfile } from '@/services/gateTrip.service'

type Tab = 'outside' | 'log'

function formatDuration(exitAt: string, returnAt?: string | null): string {
  const end = returnAt ? new Date(returnAt) : new Date()
  const mins = Math.round((end.getTime() - new Date(exitAt).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60); const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function TripRow({ trip, showReturn }: { trip: GateTripWithProfile; showReturn: boolean }) {
  const profile  = trip.profiles
  const name     = profile?.full_name ?? 'Unknown'
  const room     = profile?.room_number
  const initials = getInitials(name)
  const color    = getAvatarColor(name)
  const isOverdue = trip.status === 'overdue'

  return (
    <div className="bg-surface rounded-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
          style={{ backgroundColor: color }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-text-primary truncate">{name}</p>
            {room && <span className="text-[11px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-pill flex-shrink-0">Rm {room}</span>}
            {isOverdue && (
              <span className="text-[11px] font-bold text-danger bg-danger-light px-1.5 py-0.5 rounded-pill flex-shrink-0 flex items-center gap-1">
                <AlertCircle size={10} /> Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <MapPin size={11} className="text-text-tertiary flex-shrink-0" />
            <span className="text-[12px] text-text-tertiary truncate">{trip.destination}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {trip.exit_at && (
              <span className="text-[12px] text-text-tertiary">Out: {formatTime(trip.exit_at)}</span>
            )}
            {showReturn && trip.return_at && (
              <>
                <ArrowRight size={10} className="text-text-tertiary" />
                <span className="text-[12px] text-text-tertiary">In: {formatTime(trip.return_at)}</span>
                <span className="text-[11px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-pill">
                  {formatDuration(trip.exit_at!, trip.return_at)}
                </span>
              </>
            )}
            {!showReturn && trip.exit_at && (
              <span className={`text-[12px] ${isOverdue ? 'text-danger font-semibold' : 'text-text-tertiary'}`}>
                {isOverdue ? 'Was due: ' : 'Due: '}{formatTime(trip.expected_return_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GateDashboardPage() {
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''
  const [tab, setTab] = useState<Tab>('outside')

  const { data: outside = [], isLoading: outsideLoading } = useQuery({
    queryKey: ['trips-currently-out', hostelId],
    queryFn:  () => getTripsCurrentlyOut(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 30_000,
  })

  const { data: log = [], isLoading: logLoading } = useQuery({
    queryKey: ['trips-today-log', hostelId],
    queryFn:  () => getTodaysTripLog(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 30_000,
  })

  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Gate Register" showBack />
      <div className="px-4 pt-16 space-y-4">

        {/* Tab bar */}
        <div className="flex bg-surface-raised rounded-inner p-1">
          <button onClick={() => setTab('outside')}
            className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${tab === 'outside' ? 'bg-surface text-primary shadow-card' : 'text-text-tertiary'}`}>
            Outside Now {outside.length > 0 && `(${outside.length})`}
          </button>
          <button onClick={() => setTab('log')}
            className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${tab === 'log' ? 'bg-surface text-primary shadow-card' : 'text-text-tertiary'}`}>
            Today's Log
          </button>
        </div>

        {tab === 'outside' ? (
          <>
            <p className="text-[12px] text-text-tertiary px-1">
              {outside.length === 0 ? 'All students are in' : `${outside.length} student${outside.length !== 1 ? 's' : ''} currently outside`}
            </p>
            {outsideLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : outside.length === 0 ? (
              <EmptyState icon={<Users size={28} />} title="All students are in" description="No students are currently signed out" />
            ) : (
              <div className="space-y-2">
                {outside.map((trip) => <TripRow key={trip.id} trip={trip} showReturn={false} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide px-1">{today}</p>
            {logLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : log.length === 0 ? (
              <EmptyState icon={<MapPin size={28} />} title="No movements today" description="Students who exit and return will appear here" />
            ) : (
              <div className="space-y-2">
                {log.map((trip) => <TripRow key={trip.id} trip={trip} showReturn={true} />)}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add lazy import and route to `src/router.tsx`**

Add after the existing `ManagerStudentDetailPage` lazy import:

```typescript
const GateDashboardPage = lazy(() => import('@/features/gate-pass/pages/GateDashboardPage'))
```

Add route inside the `StaffOnlyGuard` children array alongside the other manager routes:

```typescript
{ path: '/manager/gate', element: <GateDashboardPage /> },
```

- [ ] **Step 3: Add Gate Register card to `ManagerDashboardPage.tsx`**

In `ManagerDashboardPage.tsx`, add the import for `getTripsCurrentlyOut`:

At the top of the file, the existing `getManagerStats` import already comes from `@/services/manager.service`. Add a new import:

```typescript
import { getTripsCurrentlyOut } from '@/services/gateTrip.service'
```

Add the query hook inside the component (alongside existing queries):

```typescript
const { data: currentlyOut = [] } = useQuery({
  queryKey: ['trips-currently-out', hostelId],
  queryFn:  () => getTripsCurrentlyOut(hostelId),
  enabled:  !!hostelId,
  refetchInterval: 30_000,
})
```

Add the Gate Register card in the JSX, after the Students card (which was added in Task 7 of the previous feature). Place it as a full-width button:

```typescript
<button
  onClick={() => navigate('/manager/gate')}
  className="w-full bg-surface rounded-card shadow-card px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
>
  <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
    <ScanLine size={16} className="text-primary" />
  </div>
  <div className="flex-1 text-left">
    <p className="text-[14px] font-semibold text-text-primary">Gate Register</p>
    <p className="text-[12px] text-text-secondary">
      {currentlyOut.length > 0
        ? `${currentlyOut.length} student${currentlyOut.length !== 1 ? 's' : ''} currently outside`
        : 'All students are in'}
    </p>
  </div>
  <ChevronRight size={18} className="text-text-tertiary flex-shrink-0" />
</button>
```

Make sure `ScanLine` is already in the `ManagerDashboardPage` imports (it is, per the existing file).

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

Verify as a manager:
- Manager dashboard shows "Gate Register" card with live outside count
- Tapping navigates to `/manager/gate`
- "Outside Now" tab shows students currently out (pending or out trips)
- "Today's Log" tab shows all exited students today with destination and times
- Both tabs auto-refresh every 30 seconds

- [ ] **Step 6: Commit**

```bash
git add src/features/gate-pass/pages/GateDashboardPage.tsx src/router.tsx src/features/dashboard/pages/ManagerDashboardPage.tsx
git commit -m "feat: add GateDashboardPage (roll call + today log) and Gate Register card on manager dashboard"
```

---

### Task 7: Manager Stats Update

**Files:**
- Modify: `src/services/manager.service.ts`

Replace the `gate_passes`-based `checkedOut`, `todayMovements`, and `getLiveGateMovements` with `gate_trips`-based queries. The `gate_passes` table itself is NOT dropped or altered.

**Interfaces:**
- `getManagerStats` returns the same shape: `{ checkedOut, activeComplaints, todayMovements, pendingDues }` — same type, different underlying query
- `getLiveGateMovements` returns the same shape: `Array<trip & { profiles: { full_name, avatar_url, room_number } }>` — same join pattern

- [ ] **Step 1: Update `getManagerStats` in `manager.service.ts`**

Replace the `checkedOut` and `todayPasses` parallel queries inside `getManagerStats`:

Old queries (lines 13-20 and 33-36 approximately):
```typescript
// Students currently outside (exit passes used today, no entry since)
supabase
  .from('gate_passes')
  .select('id', { count: 'exact', head: true })
  .eq('hostel_id', hostelId)
  .eq('pass_type', 'exit')
  .eq('status', 'used')
  .gte('scanned_at', today),

// Total gate movements today
supabase
  .from('gate_passes')
  .select('id', { count: 'exact', head: true })
  .eq('hostel_id', hostelId)
  .gte('generated_at', today),
```

New queries:
```typescript
// Students currently outside: trips with status 'out' or 'overdue'
supabase
  .from('gate_trips')
  .select('id', { count: 'exact', head: true })
  .eq('hostel_id', hostelId)
  .in('status', ['out', 'overdue']),

// Total gate movements today: trips where exit_at is today
supabase
  .from('gate_trips')
  .select('id', { count: 'exact', head: true })
  .eq('hostel_id', hostelId)
  .gte('exit_at', today)
  .not('exit_at', 'is', null),
```

- [ ] **Step 2: Update `getLiveGateMovements` in `manager.service.ts`**

Old query:
```typescript
export async function getLiveGateMovements(hostelId: string, limit = 10) {
  const { data } = await supabase
    .from('gate_passes')
    .select('*, profiles(full_name, avatar_url, room_number)')
    .eq('hostel_id', hostelId)
    .eq('status', 'used')
    .order('scanned_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
```

New query:
```typescript
export async function getLiveGateMovements(hostelId: string, limit = 10) {
  const { data } = await supabase
    .from('gate_trips')
    .select('*, profiles(full_name, avatar_url, room_number)')
    .eq('hostel_id', hostelId)
    .not('exit_at', 'is', null)
    .order('exit_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
```

Note: `ManagerDashboardPage` uses `getLiveGateMovements` to render a recent movements list. The returned shape changes (`scanned_at` → `exit_at`, `pass_type` → no equivalent field). Read `ManagerDashboardPage.tsx` to see exactly how the returned data is consumed and update any field references.

Look for these field accesses in `ManagerDashboardPage.tsx` and update them:
- `movement.scanned_at` → `(movement as any).exit_at` — but prefer casting the type properly
- `movement.pass_type` — no direct equivalent; remove or replace with destination

The simplest fix: define a `GateTripMovement` type in `manager.service.ts` and return it from `getLiveGateMovements`:

```typescript
export type GateTripMovement = {
  id: string
  destination: string
  purpose: string | null
  exit_at: string | null
  return_at: string | null
  status: string
  profiles: { full_name: string; avatar_url: string | null; room_number: string | null } | null
}

export async function getLiveGateMovements(hostelId: string, limit = 10): Promise<GateTripMovement[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('id, destination, purpose, exit_at, return_at, status, profiles(full_name, avatar_url, room_number)')
    .eq('hostel_id', hostelId)
    .not('exit_at', 'is', null)
    .order('exit_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as GateTripMovement[]
}
```

Then update `ManagerDashboardPage.tsx` where `getLiveGateMovements` result is rendered: replace `movement.scanned_at` with `movement.exit_at`, replace `movement.pass_type` with `movement.destination` (show destination instead of entry/exit type in the live feed).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Verify:
- Manager dashboard stats card shows correct "outside" count (matches gate_trips with status out/overdue)
- Live gate movements feed shows trip destination and time, not old pass_type
- GateDashboardPage still works correctly (it queries gateTrip.service directly, unaffected)

- [ ] **Step 5: Commit**

```bash
git add src/services/manager.service.ts src/features/dashboard/pages/ManagerDashboardPage.tsx
git commit -m "feat: update manager stats and live gate feed to use gate_trips instead of gate_passes"
```
