# Gate Pass System Redesign — Trip-Based Model

**Date:** 2026-06-23
**Status:** Approved

---

## Problem

The current gate pass system uses 5-minute dynamic QR tokens that treat entry and exit as disconnected events.
Hostels are forced to maintain a parallel paper register because the digital system cannot answer:
"Who is outside right now?" "Where did they go?" "When are they due back?"

Root cause: the system tracks individual scan events, not paired trips. A paper register has one row per
outing — out time, destination, expected return, actual return. The digital system has two unlinked rows.

---

## Design: Static QR Identity + Trip-Based Model

### Core shift

Every student gets a **permanent `qr_identity_token`** on their profile — their digital ID card.
This is a UUID, always available in the app even offline (cached in local storage).

Instead of generating a short-lived QR code, a student **creates a trip** (destination, purpose,
expected return time) before leaving. The trip record is their authorisation to exit.

The guard scans the student's **static QR** at the gate. The scanner looks up the student and
shows their pending trip, then the guard taps "Approve Exit". On return, the guard scans the same
QR and taps "Log Return". The trip is now closed.

### `gate_trips` table

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid PK | NO | |
| `user_id` | uuid → profiles | NO | Student taking the trip |
| `hostel_id` | uuid → hostels | NO | For RLS isolation |
| `destination` | text | NO | Required — where are they going |
| `purpose` | text | YES | Optional free text |
| `expected_return_at` | timestamptz | NO | Always required |
| `exit_at` | timestamptz | YES | Set when guard approves exit |
| `exit_approved_by` | uuid → profiles | YES | Guard/warden who approved |
| `return_at` | timestamptz | YES | Set when guard logs return |
| `return_logged_by` | uuid → profiles | YES | Guard who logged return |
| `status` | trip_status | NO | Default: `pending` |
| `linked_leave_id` | uuid → leave_requests | YES | For holiday departures |
| `guard_notes` | text | YES | Guard can add notes |
| `created_at` | timestamptz | NO | |
| `updated_at` | timestamptz | NO | |

**Status enum:** `pending | out | returned | overdue | cancelled`

**Unique constraints:**
- Only one `pending` trip per student at a time
- Only one `out` trip per student at a time

### Profile changes

- `profiles.qr_identity_token text unique not null` — generated at profile creation
- Existing profiles backfilled with `gen_random_uuid()::text`

### Hostel changes

- `hostels.curfew_time time` — nullable. Null means no curfew enforced.

### RPCs

**`use_trip_exit(p_qr_token text, p_guard_notes text default null)`**
Security definer. Finds student by `qr_identity_token`, finds their `pending` trip, sets status to
`out`, records `exit_at` and `exit_approved_by`. Returns trip scan result. Fails if no pending trip.

**`use_trip_return(p_qr_token text, p_guard_notes text default null)`**
Security definer. Finds student by `qr_identity_token`, finds their `out` trip, sets status to
`returned`, records `return_at` and `return_logged_by`. Returns trip scan result with duration.

**`guard_create_trip(p_user_id uuid, p_destination text, p_expected_return_at timestamptz, p_purpose text default null)`**
Security definer. Guard creates and immediately approves a trip (directly to `out` status).
Used when student has no phone or forgot to create request. Returns the new trip id.

**`mark_overdue_trips()`**
Updates trips in `out` status where `expected_return_at < now()` to `overdue`.
Intended to be called by a pg_cron job every 5 minutes.

---

## Three Scanner Flows

### Flow 1 — Standard (student pre-requests)
1. Student opens app → "My Gate Pass" tab → fills destination + expected return → submits
2. Trip created with status `pending`
3. At gate: student shows static QR
4. Guard scans → scanner shows pending trip details
5. Guard taps "Approve Exit" → `use_trip_exit` RPC → trip becomes `out`
6. On return: guard scans QR → scanner shows open trip → "Log Return" → `use_trip_return` RPC

### Flow 2 — Guard-initiated (dead battery / forgot to create trip)
1. Guard scans QR → scanner shows student with NO pending trip
2. Guard taps "Create Trip" → minimal form: destination + expected return
3. `guard_create_trip` RPC creates trip directly in `out` status
4. Return logged same as Flow 1

### Flow 3 — Approved leave departure
1. Guard scans QR → scanner fetches pending trip (student pre-created)
2. Scanner also fetches any approved `leave_request` for this student covering today
3. If found: scanner shows "Approved Leave: [destination] until [date]" badge
4. Guard approves → trip linked to leave request via `linked_leave_id`

---

## Curfew Enforcement

When guard taps "Approve Exit":
- System checks `hostel.curfew_time` (from auth store, loaded on login)
- If `curfew_time` is set AND current local time is past it AND trip has no `linked_leave_id`:
  - Scanner shows warning: "Past curfew (XX:XX PM). No approved leave on record."
  - Guard must tap "Confirm Override" to proceed (logged in `guard_notes`)
- Does NOT block — guard always has final authority

Student app shows a soft advisory in the trip creation form when past curfew:
"Exit requests after [curfew_time] require warden approval at the gate."
This is informational only — it does not block trip creation.

---

## Student UI Changes (GatePassPage)

**"My Gate Pass" tab replaces "My Passes" tab:**

Static QR card (always visible, no countdown):
- QR code encoding `profile.qr_identity_token`
- Student name + room number chips below
- Caption: "Show this at the gate when crossing"

Trip creation form (shown when no pending/out trip):
- Destination (text, required)
- Purpose (text, optional)
- Expected return: preset buttons — "2 hrs", "This evening (8 PM)", "Tonight (10 PM)",
  "Tomorrow morning", or "Custom" (shows datetime input)
- Submit button

Current trip status card (shown when pending/out trip exists):
- `pending` → "Trip Request Submitted — Waiting at gate" — shows destination, expected return, Cancel button
- `out` → "Currently Outside" — shows destination, exit time, expected return time, overdue badge if overdue

Recent trips preview (last 3) + "View all" → `/gate-pass/history`

**"Visitor Passes" tab:** unchanged.

---

## TripHistoryPage (`/gate-pass/history`)

Replaces current `PassHistoryPage`. Shows `gate_trips` grouped by date.
Each row: destination, exit → return times (or status if not returned), duration.
Old `gate_passes` history is NOT shown (deprecated).

---

## Roll Call Dashboard (`/manager/gate`)

Warden-only page. Two sections:

**Currently Outside:**
- Students with `status IN ('out', 'overdue')` for this hostel
- Each row: name, room, destination, exit time, expected return, overdue badge if overdue
- Empty state: "All students are in"

**Today's Gate Log:**
- All trips where `exit_at::date = today` for this hostel, ordered by `exit_at DESC`
- Each row: name, room, destination, out time, in time (or "Still outside"), duration
- This is the digital equivalent of the paper register

Navigation entry: card in `ManagerDashboardPage` titled "Gate Register".

---

## Manager Dashboard Stats Update

`getManagerStats` currently uses `gate_passes` for `checkedOut` and `todayMovements`.
After this feature: use `gate_trips` instead.

- `checkedOut` → count of `gate_trips` where `hostel_id = hostelId` AND `status IN ('out', 'overdue')`
- `todayMovements` → count of `gate_trips` where `hostel_id = hostelId` AND `exit_at::date = today`

`getLiveGateMovements` (live feed on manager dashboard) → query `gate_trips` with `profiles` join,
where `exit_at IS NOT NULL`, order by `exit_at DESC`.

---

## Out of Scope

- Visitor trips (visitors table stays as-is)
- Realtime push to student when room assignment changes via trip
- pg_cron scheduling (migration provides the function; actual scheduling is manual via Supabase dashboard)
- Bulk trip management (hostel lockdown)
- Export to CSV/PDF
