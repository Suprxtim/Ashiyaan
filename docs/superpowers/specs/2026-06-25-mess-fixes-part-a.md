# Mess Fixes Part A — Design Spec

**Date:** 2026-06-25
**Status:** Approved

---

## Problem Summary

1. **Student menu invisible** — Food items are fetched but never rendered on the student Mess page. Students see meal toggles with no food listed.
2. **No opt-out cutoff** — `isPast` only checks `date < today`, so students can toggle off a meal hours after it ended.
3. **No per-hostel meal configuration** — Meal timings and enabled/disabled meals are hardcoded in the client.
4. **Manager dashboard shows wrong meal** — `getMessOccupancy` hardcodes `dinner`. At 2:30 AM it still says "Expected for dinner tonight" with wrong count.

---

## Scope

Part A covers:
- DB migration: `mess_settings` table
- Student page: show menu items, enforce per-meal cutoffs, hide disabled meals
- Warden: new `/mess/settings` page to configure meal timings, cutoffs, enable/disable
- Manager dashboard: all enabled meals with expected counts, current/next meal highlighted

Out of scope (Part B): who opted out per meal, next-day planning view, notifications.

---

## Data Model

### New table: `mess_settings`

```sql
create table mess_settings (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references hostels(id) on delete cascade,
  meal_type    meal_type not null,   -- existing enum: breakfast | lunch | dinner
  enabled      bool not null default true,
  start_time   time not null,
  end_time     time not null,
  cutoff_time  time not null,        -- students cannot toggle after this time on the day
  unique(hostel_id, meal_type)
);

create index mess_settings_hostel_idx on mess_settings(hostel_id);
```

### RLS

- `SELECT`: authenticated users whose `hostel_id` matches (students + managers).
- `INSERT/UPDATE/DELETE`: only `warden` or `manager` role for their own hostel.

### Defaults seeded in migration

For all existing hostels (via `INSERT ... ON CONFLICT DO NOTHING`):

| meal_type | start_time | end_time | cutoff_time |
|-----------|------------|----------|-------------|
| breakfast | 08:00      | 10:00    | 07:30       |
| lunch     | 13:00      | 15:00    | 12:30       |
| dinner    | 20:00      | 22:00    | 19:30       |

### New hostel defaults

`create_hostel_for_user` RPC (migration 007) is updated to `INSERT` these 3 rows immediately after creating the hostel, so new wardens never get a broken mess page.

---

## TypeScript Types

New type added to `database.types.ts`:

```typescript
mess_settings: {
  Row: {
    id: string
    hostel_id: string
    meal_type: 'breakfast' | 'lunch' | 'dinner'
    enabled: boolean
    start_time: string   // Postgres time → "HH:MM:SS" string, e.g. "07:30:00"
    end_time: string     // Parse as: const [h, m] = val.split(':').map(Number)
    cutoff_time: string  // Compare against: now.getHours() * 60 + now.getMinutes()
  }
  Insert: { ... }
  Update: { ... }
}
```

App-level type in `app.types.ts`:
```typescript
export type MessSetting = Database['public']['Tables']['mess_settings']['Row']
```

---

## Service Layer

### `src/services/mess.service.ts` — additions

```typescript
// Fetch all mess_settings for a hostel (cached, rarely changes)
export async function getMessSettings(hostelId: string): Promise<MessSetting[]>

// Warden upserts one meal's settings
export async function upsertMessSetting(
  hostelId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  config: { enabled: boolean; start_time: string; end_time: string; cutoff_time: string }
): Promise<void>

// Today's expected count per meal (replaces getMessOccupancy)
// Returns total students and opted-out count per meal for a given date
export async function getTodaysMealCounts(hostelId: string, date: string): Promise<{
  breakfast: { total: number; optedOut: number }
  lunch:     { total: number; optedOut: number }
  dinner:    { total: number; optedOut: number }
}>
```

`getMessOccupancy` is kept for now but no longer used by the dashboard — it will be deleted in a cleanup pass.

### Current/next meal detection (pure function, no DB)

```typescript
// Returns which meal is currently active or coming next, given settings and current time
export function getCurrentMeal(
  settings: MessSetting[],
  now: Date
): { meal: MessSetting; status: 'active' | 'next' } | null
```

Logic:
1. Parse each enabled meal's `start_time` and `end_time` into today's Date objects.
2. If `now` is between `start_time` and `end_time` → that meal is `active`.
3. If `now` is before a meal's `start_time` → that meal is `next` (pick the earliest one).
4. If all meals are past → pick tomorrow's first enabled meal (`next`).

---

## Student Mess Page (`MessPage.tsx` + `useMessMenu.ts`)

### Hook changes (`useMessMenu.ts`)

- Add `mess_settings` query: `queryKey: ['mess-settings', hostelId]`, `staleTime: Infinity` (changes rarely).
- Export `settings: MessSetting[]` from the hook.
- Export `isCutoffPassed(date: string, meal: 'breakfast' | 'lunch' | 'dinner'): boolean`:
  - Returns `false` if `date !== today`.
  - Returns `false` if meal is not in settings (treat as open).
  - Returns `true` if `currentTime >= cutoff_time` for that meal on today's date.

### Page changes (`MessPage.tsx`)

**Meal list** — only render meals where `settings.find(s => s.meal_type === key)?.enabled !== false`. If a meal is disabled (e.g., no breakfast at this hostel), hide it entirely.

**Toggle disabled state** — current code disables when `isPastDate`. Add: also disable when `isCutoffPassed(selectedDate, key)`.

**Cutoff label** — when cutoff has passed for today's meal, show a small label below the time:
```
"08:00 AM – 10:00 AM"
"Opt-out closed at 7:30 AM"     ← shown in text-tertiary
```

**Menu items** — below the time label, render the items array for that date + meal:
```
"Dal · Rice · Sabzi · Roti"    ← items joined by " · ", text-[12px] text-text-secondary
```
If no items posted: render nothing (don't show "Menu not posted" inline — that clutters the list).

**Tomorrow's Menu preview** — currently hardcoded to show only `dinner`. Change to show the first enabled meal of tomorrow (using `settings` order: breakfast → lunch → dinner).

---

## Warden Settings Page

### New page: `src/features/mess/pages/MessSettingsPage.tsx`

Route: `/mess/settings` — accessible to `warden` and `manager` roles only (guarded by `StaffOnlyGuard`).

**Layout:**
- TopBar: "Mess Settings" with back button.
- One card per meal (Breakfast, Lunch, Dinner) in order, skipped if not in DB (shouldn't happen after migration).
- Each card contains:
  - **Meal header** with icon + label + enable/disable `Toggle` on the right.
  - When enabled: three time fields (Start, End, Cutoff) as `<input type="time">` controls.
  - When disabled: body fades out (`opacity-50`), time fields hidden.
  - Save button per card (saves only that meal's settings on press — no full-page submit).
- Below cards: informational note: *"Cutoff time is when students can no longer change their attendance for that meal."*

### Router

Add lazy import + route `/mess/settings` inside `StaffOnlyGuard` in `router.tsx`.

### Warden dashboard quick action

Add "Mess Settings" entry to the warden quick-action grid in `ManagerDashboardPage.tsx`, navigating to `/mess/settings`.

---

## Manager Dashboard — Mess Card

### Service function: `getTodaysMealCounts`

Single query to `mess_optouts` for today, grouping by meal to count `breakfast = false`, `lunch = false`, `dinner = false`. Combined with total student count from profiles.

Returns:
```typescript
{
  breakfast: { total: number; optedOut: number; expected: number }
  lunch:     { total: number; optedOut: number; expected: number }
  dinner:    { total: number; optedOut: number; expected: number }
}
```

### Dashboard card changes

Replace the single `getMessOccupancy` call with `getTodaysMealCounts`. Keep `refetchInterval: 60_000`.

**Card layout (all enabled meals as rows):**
```
MESS TODAY                      🍽

● Breakfast   24 / 28 expected  ← current/next meal: green dot + bold
  Lunch       27 / 28 expected
  Dinner      25 / 28 expected
```

- Dot color: green for `active` meal, amber for `next` meal, none for past meals.
- `getCurrentMeal(settings, new Date())` drives which row gets the indicator.
- If settings aren't loaded yet: skeleton rows.
- `mess_settings` query added to manager dashboard with same `staleTime: Infinity`.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/015_mess_settings.sql` | CREATE TABLE + RLS + seed + RPC update |
| `src/types/database.types.ts` | Add `mess_settings` table types |
| `src/types/app.types.ts` | Add `MessSetting` export |
| `src/services/mess.service.ts` | Add `getMessSettings`, `upsertMessSetting`, `getTodaysMealCounts`, `getCurrentMeal` |
| `src/features/mess/hooks/useMessMenu.ts` | Add settings query, `isCutoffPassed`, export `settings` |
| `src/features/mess/pages/MessPage.tsx` | Show menu items, cutoff label, filter disabled meals, fix tomorrow's meal |
| `src/features/mess/pages/MessSettingsPage.tsx` | NEW — warden settings UI |
| `src/router.tsx` | Add `/mess/settings` route |
| `src/features/dashboard/pages/ManagerDashboardPage.tsx` | Replace mess card, add settings query, add quick action |

---

## Out of Scope

- No changes to `MessBillPage.tsx` or `MessMenuEditorPage.tsx`
- No notification system (Part B)
- No "who opted out" list (Part B)
- No next-day planning view (Part B)
