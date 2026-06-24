# Mess Fixes Part A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix student menu visibility, enforce per-meal opt-out cutoffs driven by warden-configurable settings, and replace the manager dashboard's hardcoded dinner count with a live all-meal view.

**Architecture:** New `mess_settings` table (one row per meal per hostel) drives cutoff enforcement on the student page and current-meal detection on the manager dashboard. All time comparisons run client-side in TypeScript from `"HH:MM:SS"` time strings fetched from Supabase. A new warden settings page at `/mess/settings` lets wardens configure timings and enable/disable meals.

**Tech Stack:** React 19, @tanstack/react-query v5, Supabase JS v2, Tailwind CSS v4, TypeScript 6, lucide-react, sonner

## Global Constraints

- No unit test framework — verification is `npm run build` (TypeScript + Vite) plus manual browser check.
- Time strings from Postgres `time` columns arrive as `"HH:MM:SS"` (e.g. `"07:30:00"`). Parse with `val.split(':').map(Number)` — never `new Date(val)`.
- Minutes-since-midnight arithmetic: `h * 60 + m` — used consistently for comparisons.
- `meal_type` enum values: `'breakfast' | 'lunch' | 'dinner'` (existing, no changes).
- `settings.length === 0` means still loading — treat all meals as enabled in that state (graceful degradation).
- No changes to `MessBillPage.tsx`, `MessMenuEditorPage.tsx`, or `MessFeedbackPage`.
- `getMessOccupancy` in `manager.service.ts` is NOT deleted (keep for safety) — just stop importing it in the dashboard.
- Commit after each task.

---

### Task 1: DB migration + TypeScript types

**Files:**
- Create: `supabase/migrations/015_mess_settings.sql`
- Modify: `src/types/database.types.ts`
- Modify: `src/types/app.types.ts`

**Interfaces:**
- Produces: `Database['public']['Tables']['mess_settings']` — Row/Insert/Update types used by Tasks 2–5.
- Produces: `export type MessSetting` in `app.types.ts` — imported by Tasks 2 and 4.

---

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/015_mess_settings.sql` with this exact content:

```sql
-- ============================================================
-- Migration 015: Mess Settings — per-hostel per-meal config
-- ============================================================

create table mess_settings (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references hostels(id) on delete cascade,
  meal_type    meal_type not null,
  enabled      bool not null default true,
  start_time   time not null,
  end_time     time not null,
  cutoff_time  time not null,
  unique(hostel_id, meal_type)
);

create index mess_settings_hostel_idx on mess_settings(hostel_id);

-- ── RLS ───────────────────────────────────────────────────────

alter table mess_settings enable row level security;

-- All authenticated users in the hostel can read settings
create policy "mess_settings_select"
  on mess_settings for select
  to authenticated
  using (hostel_id = (select hostel_id from profiles where id = auth.uid()));

-- Only warden / manager can write
create policy "mess_settings_insert"
  on mess_settings for insert
  to authenticated
  with check (
    hostel_id = (select hostel_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('warden', 'manager')
  );

create policy "mess_settings_update"
  on mess_settings for update
  to authenticated
  using (
    hostel_id = (select hostel_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('warden', 'manager')
  )
  with check (
    hostel_id = (select hostel_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) in ('warden', 'manager')
  );

-- ── Seed defaults for all existing hostels ────────────────────

insert into mess_settings (hostel_id, meal_type, start_time, end_time, cutoff_time)
select id, 'breakfast'::meal_type, '08:00'::time, '10:00'::time, '07:30'::time from hostels
union all
select id, 'lunch'::meal_type,     '13:00'::time, '15:00'::time, '12:30'::time from hostels
union all
select id, 'dinner'::meal_type,    '20:00'::time, '22:00'::time, '19:30'::time from hostels
on conflict (hostel_id, meal_type) do nothing;

-- ── Update create_hostel_for_user RPC to seed defaults ────────

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
  insert into hostels (name, city, state, contact_phone, total_rooms, property_type)
  values (p_name, p_city, p_state, p_contact_phone, p_total_rooms, p_property_type)
  returning * into v_hostel;

  -- Seed default mess settings
  insert into mess_settings (hostel_id, meal_type, start_time, end_time, cutoff_time)
  values
    (v_hostel.id, 'breakfast'::meal_type, '08:00'::time, '10:00'::time, '07:30'::time),
    (v_hostel.id, 'lunch'::meal_type,     '13:00'::time, '15:00'::time, '12:30'::time),
    (v_hostel.id, 'dinner'::meal_type,    '20:00'::time, '22:00'::time, '19:30'::time);

  v_role := case when p_property_type = 'shared' then 'student'::user_role else 'manager'::user_role end;

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
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with the SQL above, or run:
```
supabase db push
```
Verify in the Supabase dashboard that the `mess_settings` table exists with 3 rows per existing hostel.

- [ ] **Step 3: Add `mess_settings` to `database.types.ts`**

In `src/types/database.types.ts`, find the `mess_rates` table block. It ends with a closing `}` and then `Relationships: [...]`. After the entire `mess_rates` block's closing `}`, insert the following block (before whatever table comes next alphabetically):

```typescript
      mess_settings: {
        Row: {
          cutoff_time: string   // "HH:MM:SS" e.g. "07:30:00"
          enabled: boolean
          end_time: string      // "HH:MM:SS"
          hostel_id: string
          id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          start_time: string    // "HH:MM:SS"
        }
        Insert: {
          cutoff_time: string
          enabled?: boolean
          end_time: string
          hostel_id: string
          id?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          start_time: string
        }
        Update: {
          cutoff_time?: string
          enabled?: boolean
          end_time?: string
          hostel_id?: string
          id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "mess_settings_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 4: Add `MessSetting` to `app.types.ts`**

In `src/types/app.types.ts`, after the `MessRate` line, add:

```typescript
export type MessSetting = Database['public']['Tables']['mess_settings']['Row']
```

The file around that line should look like:
```typescript
export type MessOptout = Database['public']['Tables']['mess_optouts']['Row']
export type MessMenu = Database['public']['Tables']['mess_menu']['Row']
export type MessRate = Database['public']['Tables']['mess_rates']['Row']
export type MessSetting = Database['public']['Tables']['mess_settings']['Row']   // ← add this
export type Complaint = Database['public']['Tables']['complaints']['Row']
```

- [ ] **Step 5: Build check**

```
npm run build
```

Expected: clean build. If you see `Property 'mess_settings' does not exist on type`, the `database.types.ts` insertion is in the wrong place — verify the block is inside `Tables: { ... }`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/015_mess_settings.sql src/types/database.types.ts src/types/app.types.ts
git commit -m "feat: add mess_settings table, types, and seed defaults"
```

---

### Task 2: Service layer — mess settings functions

**Files:**
- Modify: `src/services/mess.service.ts`

**Interfaces:**
- Consumes: `MessSetting` from `@/types/app.types` (Task 1)
- Produces:
  - `getMessSettings(hostelId: string): Promise<MessSetting[]>` — fetched by Tasks 3, 4, 5
  - `upsertMessSetting(hostelId, mealType, config): Promise<void>` — used by Task 4
  - `getTodaysMealCounts(hostelId, date): Promise<MealCounts>` — used by Task 5
  - `getCurrentMeal(settings, now): { meal: MessSetting; status: 'active' | 'next' } | null` — used by Task 5
  - `export type MealCounts` — used by Task 5

---

- [ ] **Step 1: Add the import and new types at the top of `mess.service.ts`**

Add to the top of `src/services/mess.service.ts`:

```typescript
import type { MessSetting } from '@/types/app.types'

export type MealCounts = {
  breakfast: { total: number; optedOut: number; expected: number }
  lunch:     { total: number; optedOut: number; expected: number }
  dinner:    { total: number; optedOut: number; expected: number }
}
```

The file's first line is currently `import { supabase } from '@/lib/supabase'`. Add the two blocks immediately after it.

- [ ] **Step 2: Add `getMessSettings`**

Append to the end of `src/services/mess.service.ts`:

```typescript
export async function getMessSettings(hostelId: string): Promise<MessSetting[]> {
  const { data } = await supabase
    .from('mess_settings')
    .select('*')
    .eq('hostel_id', hostelId)
  return data ?? []
}
```

Returns all rows (up to 3). The caller sorts them into display order.

- [ ] **Step 3: Add `upsertMessSetting`**

```typescript
export async function upsertMessSetting(
  hostelId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  config: { enabled: boolean; start_time: string; end_time: string; cutoff_time: string },
): Promise<void> {
  const { error } = await supabase
    .from('mess_settings')
    .upsert(
      { hostel_id: hostelId, meal_type: mealType, ...config },
      { onConflict: 'hostel_id,meal_type' },
    )
  if (error) throw error
}
```

- [ ] **Step 4: Add `getTodaysMealCounts`**

```typescript
export async function getTodaysMealCounts(hostelId: string, date: string): Promise<MealCounts> {
  const [totalRes, optoutsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .eq('role', 'student')
      .eq('is_active', true),
    supabase
      .from('mess_optouts')
      .select('breakfast, lunch, dinner')
      .eq('hostel_id', hostelId)
      .eq('date', date),
  ])

  const total   = totalRes.count ?? 0
  const optouts = optoutsRes.data ?? []

  const bfOut     = optouts.filter((o) => !o.breakfast).length
  const lunchOut  = optouts.filter((o) => !o.lunch).length
  const dinnerOut = optouts.filter((o) => !o.dinner).length

  return {
    breakfast: { total, optedOut: bfOut,     expected: total - bfOut     },
    lunch:     { total, optedOut: lunchOut,  expected: total - lunchOut  },
    dinner:    { total, optedOut: dinnerOut, expected: total - dinnerOut },
  }
}
```

- [ ] **Step 5: Add `getCurrentMeal`**

```typescript
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'] as const

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function getCurrentMeal(
  settings: MessSetting[],
  now: Date,
): { meal: MessSetting; status: 'active' | 'next' } | null {
  const enabled = MEAL_ORDER
    .map((key) => settings.find((s) => s.meal_type === key))
    .filter((s): s is MessSetting => !!s && s.enabled)

  if (enabled.length === 0) return null

  const nowMins = now.getHours() * 60 + now.getMinutes()

  for (const meal of enabled) {
    if (nowMins >= toMins(meal.start_time) && nowMins < toMins(meal.end_time)) {
      return { meal, status: 'active' }
    }
  }

  for (const meal of enabled) {
    if (nowMins < toMins(meal.start_time)) {
      return { meal, status: 'next' }
    }
  }

  // All meals done for the calendar day — next meal is tomorrow's first
  return { meal: enabled[0], status: 'next' }
}
```

Note: `MEAL_ORDER` and `toMins` are module-level constants/helpers — not exported. `getCurrentMeal` is exported and used by Tasks 3 and 5.

- [ ] **Step 6: Build check**

```
npm run build
```

Expected: clean build. Common mistake: if TypeScript complains about `MessSetting` not found, verify `src/types/app.types.ts` has the export from Task 1.

- [ ] **Step 7: Commit**

```bash
git add src/services/mess.service.ts
git commit -m "feat: add getMessSettings, upsertMessSetting, getTodaysMealCounts, getCurrentMeal"
```

---

### Task 3: Student Mess Page — menu items, cutoff enforcement, disabled meals

**Files:**
- Modify: `src/features/mess/hooks/useMessMenu.ts`
- Modify: `src/features/mess/pages/MessPage.tsx`

**Interfaces:**
- Consumes: `getMessSettings` (Task 2), `MessSetting` type (Task 1)
- Produces: `settings: MessSetting[]` and `isCutoffPassed(date, meal): boolean` exported from hook

---

- [ ] **Step 1: Update `useMessMenu.ts` imports**

In `src/features/mess/hooks/useMessMenu.ts`, change the service import line from:

```typescript
import { getWeekMenu, getWeekOptouts, upsertOptout, getActiveMessRate, getMonthOptouts } from '@/services/mess.service'
```

To:

```typescript
import { getWeekMenu, getWeekOptouts, upsertOptout, getActiveMessRate, getMonthOptouts, getMessSettings } from '@/services/mess.service'
import type { MessSetting } from '@/types/app.types'
```

- [ ] **Step 2: Add `mess_settings` query inside `useMessMenu`**

Inside the `useMessMenu` function body, after the existing `{ data: rate }` query (around line 50), add:

```typescript
  const { data: settings = [] } = useQuery({
    queryKey: ['mess-settings', hostelId],
    queryFn:  () => getMessSettings(hostelId),
    enabled:  !!hostelId,
    staleTime: Infinity,
  })
```

- [ ] **Step 3: Add `isCutoffPassed` function inside `useMessMenu`**

After the `settings` query (before the `togglingMealKey` state), add:

```typescript
  const todayStr = new Date().toLocaleDateString('en-CA')

  function isCutoffPassed(date: string, meal: 'breakfast' | 'lunch' | 'dinner'): boolean {
    if (date !== todayStr) return false
    const s = settings.find((s) => s.meal_type === meal)
    if (!s) return false
    const now     = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const [h, m]  = s.cutoff_time.split(':').map(Number)
    return nowMins >= h * 60 + m
  }
```

- [ ] **Step 4: Export `settings` and `isCutoffPassed` from the hook**

In the `return` statement at the bottom of `useMessMenu`, add `settings` and `isCutoffPassed`:

```typescript
  return {
    weekDates,
    weekOffset,
    setWeekOffset,
    selectedDate,
    setSelectedDate,
    getMealState,
    getMenuItems,
    toggleMeal,
    togglingMealKey,
    rate,
    savedThisMonth,
    optedOutMealsCount,
    settings,
    isCutoffPassed,
  }
```

- [ ] **Step 5: Update `MessPage.tsx` — destructure new hook values**

In `src/features/mess/pages/MessPage.tsx`, update the `useMessMenu()` destructure (around line 24) to include the new exports:

```typescript
  const {
    weekDates, setWeekOffset,
    selectedDate, setSelectedDate,
    getMealState, getMenuItems,
    toggleMeal, togglingMealKey,
    savedThisMonth, optedOutMealsCount,
    settings,
    isCutoffPassed,
  } = useMessMenu()
```

- [ ] **Step 6: Fix tomorrow's menu — use first enabled meal instead of hardcoded dinner**

In `MessPage.tsx`, replace:

```typescript
  const tomorrowMenu = getMenuItems(tomorrow, 'dinner')
```

With:

```typescript
  const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const
  const firstEnabledKey = MEAL_KEYS.find(
    (m) => settings.length === 0 || settings.find((s) => s.meal_type === m)?.enabled !== false
  ) ?? 'breakfast'
  const tomorrowMenu = getMenuItems(tomorrow, firstEnabledKey)
```

- [ ] **Step 7: Update the meal list — filter disabled meals, show menu items, show cutoff label**

In `MessPage.tsx`, find the `{/* ── Today's Attendance ── */}` section. Replace the `{MEALS.map(...)}` block (currently lines 155–180) with:

```tsx
            {MEALS
              .filter(({ key }) =>
                settings.length === 0 || settings.find((s) => s.meal_type === key)?.enabled !== false
              )
              .map(({ key, label, time, Icon }, idx, arr) => {
                const isOn       = selectedMeals[key]
                const isPastDate = isPast(selectedDate)
                const isCutoff   = isCutoffPassed(selectedDate, key)
                const isBusy     = togglingMealKey === `${selectedDate}-${key}`
                const menuItems  = getMenuItems(selectedDate, key)
                const setting    = settings.find((s) => s.meal_type === key)
                return (
                  <div key={key}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${!isOn ? 'bg-danger-light/30' : ''}`}>
                      <div className={`w-9 h-9 rounded-inner flex items-center justify-center flex-shrink-0 ${
                        isOn ? 'bg-primary-light' : 'bg-surface-raised'
                      }`}>
                        <Icon size={18} className={isOn ? 'text-primary' : 'text-text-tertiary'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary">{label}</p>
                        <p className="text-[12px] text-text-tertiary">{time}</p>
                        {menuItems.length > 0 && (
                          <p className="text-[12px] text-text-secondary mt-0.5 truncate">
                            {menuItems.join(' · ')}
                          </p>
                        )}
                        {isCutoff && setting && (
                          <p className="text-[11px] text-text-tertiary mt-0.5">
                            Opt-out closed at {setting.cutoff_time.slice(0, 5)}
                          </p>
                        )}
                      </div>
                      <Toggle
                        checked={isOn}
                        disabled={isPastDate || isCutoff || isBusy}
                        onChange={(val) => toggleMeal({ date: selectedDate, meal: key, value: val })}
                      />
                    </div>
                  </div>
                )
              })}
```

- [ ] **Step 8: Update the Tomorrow's Menu badge label**

In `MessPage.tsx`, find the `"Dinner Special"` badge inside the Tomorrow's Menu section (around line 288). Replace:

```tsx
                <span className="bg-accent text-text-on-accent text-[10px] font-bold px-2.5 py-1 rounded-pill uppercase">
                  Dinner Special
                </span>
```

With:

```tsx
                <span className="bg-accent text-text-on-accent text-[10px] font-bold px-2.5 py-1 rounded-pill uppercase">
                  {firstEnabledKey.charAt(0).toUpperCase() + firstEnabledKey.slice(1)} Special
                </span>
```

- [ ] **Step 9: Build check**

```
npm run build
```

Expected: clean build. Common mistake: if `settings` or `isCutoffPassed` is not recognised, verify the hook's return statement was updated in Step 4.

- [ ] **Step 10: Manual browser check**

Open the student Mess page and verify:
1. Food items appear under the time label for each meal when menu is posted (manager must have posted items via `/mess/menu-editor`).
2. Toggling a meal still works for today's upcoming meals.
3. Tomorrow's Menu preview shows the correct first enabled meal (not hardcoded Dinner).

- [ ] **Step 11: Commit**

```bash
git add src/features/mess/hooks/useMessMenu.ts src/features/mess/pages/MessPage.tsx
git commit -m "feat: show menu items per meal, enforce per-meal cutoff, filter disabled meals"
```

---

### Task 4: Warden settings page + router

**Files:**
- Create: `src/features/mess/pages/MessSettingsPage.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `getMessSettings`, `upsertMessSetting` (Task 2), `MessSetting` (Task 1)

---

- [ ] **Step 1: Create `MessSettingsPage.tsx`**

Create `src/features/mess/pages/MessSettingsPage.tsx` with the following complete content:

```tsx
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Coffee, UtensilsCrossed, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getMessSettings, upsertMessSetting } from '@/services/mess.service'
import { TopBar } from '@/components/layout/TopBar'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import type { MessSetting } from '@/types/app.types'

type MealKey = 'breakfast' | 'lunch' | 'dinner'

const MEAL_META: { key: MealKey; label: string; Icon: React.ElementType }[] = [
  { key: 'breakfast', label: 'Breakfast', Icon: Coffee },
  { key: 'lunch',     label: 'Lunch',     Icon: UtensilsCrossed },
  { key: 'dinner',    label: 'Dinner',    Icon: Moon },
]

export default function MessSettingsPage() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['mess-settings', hostelId],
    queryFn:  () => getMessSettings(hostelId),
    enabled:  !!hostelId,
    staleTime: Infinity,
  })

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Mess Settings" showBack />
      <div className="pt-14 px-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-card shadow-card h-28 skeleton" />
            ))}
          </div>
        ) : (
          MEAL_META.map(({ key, label, Icon }) => {
            const s = settings.find((m) => m.meal_type === key)
            if (!s) return null
            return (
              <MealSettingCard
                key={key}
                mealType={key}
                label={label}
                Icon={Icon}
                setting={s}
                hostelId={hostelId}
                onSaved={() => qc.invalidateQueries({ queryKey: ['mess-settings'] })}
              />
            )
          })
        )}
        <p className="text-[12px] text-text-tertiary text-center px-4 pb-4">
          Cutoff time is when students can no longer change their attendance for that meal.
        </p>
      </div>
    </div>
  )
}

function MealSettingCard({
  mealType, label, Icon, setting, hostelId, onSaved,
}: {
  mealType: MealKey
  label: string
  Icon: React.ElementType
  setting: MessSetting
  hostelId: string
  onSaved: () => void
}) {
  const [enabled,    setEnabled]    = useState(setting.enabled)
  const [startTime,  setStartTime]  = useState(setting.start_time.slice(0, 5))
  const [endTime,    setEndTime]    = useState(setting.end_time.slice(0, 5))
  const [cutoffTime, setCutoffTime] = useState(setting.cutoff_time.slice(0, 5))

  useEffect(() => {
    setEnabled(setting.enabled)
    setStartTime(setting.start_time.slice(0, 5))
    setEndTime(setting.end_time.slice(0, 5))
    setCutoffTime(setting.cutoff_time.slice(0, 5))
  }, [setting])

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      upsertMessSetting(hostelId, mealType, {
        enabled,
        start_time:  startTime,
        end_time:    endTime,
        cutoff_time: cutoffTime,
      }),
    onSuccess: () => { toast.success(`${label} settings saved`); onSaved() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <div className="bg-surface rounded-card shadow-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-inner flex items-center justify-center flex-shrink-0 ${
          enabled ? 'bg-primary-light' : 'bg-surface-raised'
        }`}>
          <Icon size={18} className={enabled ? 'text-primary' : 'text-text-tertiary'} />
        </div>
        <p className="flex-1 text-[15px] font-bold text-text-primary">{label}</p>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {([
              { fieldLabel: 'Start',  value: startTime,  set: setStartTime  },
              { fieldLabel: 'End',    value: endTime,    set: setEndTime    },
              { fieldLabel: 'Cutoff', value: cutoffTime, set: setCutoffTime },
            ] as const).map(({ fieldLabel, value, set }) => (
              <div key={fieldLabel}>
                <p className="text-[11px] font-semibold text-text-tertiary mb-1 uppercase tracking-wide">
                  {fieldLabel}
                </p>
                <input
                  type="time"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full h-9 bg-surface-raised border border-border rounded-input px-2 text-[13px] text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="dark" size="sm" loading={saving} onClick={() => save()}>
              Save
            </Button>
          </div>
        </div>
      )}

      {!enabled && (
        <div className="flex justify-end">
          <Button variant="dark" size="sm" loading={saving} onClick={() => save()}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the lazy import to `router.tsx`**

In `src/router.tsx`, after line 52 (`const MessMenuEditorPage = lazy(...)`), add:

```typescript
const MessSettingsPage = lazy(() => import('@/features/mess/pages/MessSettingsPage'))
```

- [ ] **Step 3: Add the route to `router.tsx`**

Find the block that contains `{ path: '/mess/menu-editor', element: <MessMenuEditorPage /> }` (inside `StaffOnlyGuard` + `PropertyTypeGuard allow={['hostel', 'pg']}`). Add `/mess/settings` alongside it:

```typescript
                          {
                            element: <PropertyTypeGuard allow={['hostel', 'pg']} />,
                            children: [
                              { path: '/mess/menu-editor', element: <MessMenuEditorPage /> },
                              { path: '/mess/settings',    element: <MessSettingsPage /> },
                              { path: '/manager/leave',    element: <ManagerLeaveRequestsPage /> },
                            ],
                          },
```

- [ ] **Step 4: Build check**

```
npm run build
```

Expected: clean build. If `TopBar` or `Toggle` import fails, verify the component paths — both exist in the codebase (`src/components/layout/TopBar.tsx` and `src/components/ui/Toggle.tsx`).

- [ ] **Step 5: Manual browser check**

Log in as warden/manager and navigate to `/mess/settings`. Verify:
1. Three meal cards show (Breakfast, Lunch, Dinner).
2. Toggle disables the meal and the time fields disappear; Save sends the update.
3. Changing Start/End/Cutoff times and saving reflects in the student page cutoff behaviour.

- [ ] **Step 6: Commit**

```bash
git add src/features/mess/pages/MessSettingsPage.tsx src/router.tsx
git commit -m "feat: add warden mess settings page at /mess/settings"
```

---

### Task 5: Manager dashboard — all-meal counts card

**Files:**
- Modify: `src/features/dashboard/pages/ManagerDashboardPage.tsx`

**Interfaces:**
- Consumes: `getTodaysMealCounts`, `getCurrentMeal`, `getMessSettings`, `MealCounts` (Task 2), `MessSetting` (Task 1)

---

- [ ] **Step 1: Update imports in `ManagerDashboardPage.tsx`**

At the top of the file, find the existing mess-related imports. Currently the service imports include `getMessOccupancy` from `manager.service`. Stop importing it (leave it in the file for safety, just remove from the import). Add the new imports.

Change this import block (around line 10–13):

```typescript
import {
  getManagerStats, getMessOccupancy, getLiveGateMovements,
  getOpenComplaints, updateComplaintStatus, getPendingPayments,
  getManagerAnalytics,
  getPendingMembers, approveJoinRequest, rejectJoinRequest,
  GateTripMovement,
} from '@/services/manager.service'
```

To:

```typescript
import {
  getManagerStats, getLiveGateMovements,
  getOpenComplaints, updateComplaintStatus, getPendingPayments,
  getManagerAnalytics,
  getPendingMembers, approveJoinRequest, rejectJoinRequest,
  GateTripMovement,
} from '@/services/manager.service'
import { getMessSettings, getTodaysMealCounts, getCurrentMeal } from '@/services/mess.service'
import type { MealCounts } from '@/services/mess.service'
```

Also add `MessSetting` type import from app types (needed for `getCurrentMeal` parameter):

```typescript
import type { MessSetting } from '@/types/app.types'
```

- [ ] **Step 2: Add `MEAL_ORDER` constant near the top of the file**

After the existing constants at the top of `ManagerDashboardPage.tsx` (after imports, before the component), add:

```typescript
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'] as const
```

- [ ] **Step 3: Replace the mess occupancy query with two new queries**

Find the existing mess query (around line 53–58):

```typescript
  const { data: mess, isLoading: messLoading } = useQuery({
    queryKey: ['mess-occupancy', hostelId],
    queryFn:  () => getMessOccupancy(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 60_000,
  })
```

Replace it with:

```typescript
  const today = new Date().toLocaleDateString('en-CA')

  const { data: mealCounts, isLoading: mealCountsLoading } = useQuery({
    queryKey: ['meal-counts', hostelId, today],
    queryFn:  () => getTodaysMealCounts(hostelId, today),
    enabled:  !!hostelId,
    refetchInterval: 60_000,
  })

  const { data: messSettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['mess-settings', hostelId],
    queryFn:  () => getMessSettings(hostelId),
    enabled:  !!hostelId,
    staleTime: Infinity,
  })
```

- [ ] **Step 4: Replace the mess occupancy card JSX**

Find the `{/* ── Mess Occupancy ── */}` block (around line 374–394):

```tsx
        {/* ── Mess Occupancy ── */}
        <div className="bg-surface rounded-card shadow-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
              Mess Occupancy
            </p>
            <UtensilsCrossed size={18} className="text-text-tertiary" />
          </div>
          {messLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <>
              <p className="text-[32px] font-bold text-text-primary leading-tight">
                {mess?.expected ?? 0}
              </p>
              <p className="text-[13px] text-text-secondary">
                Expected for dinner tonight{mess?.total ? ` · ${mess.total} total` : ''}
              </p>
            </>
          )}
        </div>
```

Replace with:

```tsx
        {/* ── Mess Today ── */}
        <div className="bg-surface rounded-card shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
              Mess Today
            </p>
            <UtensilsCrossed size={18} className="text-text-tertiary" />
          </div>
          {mealCountsLoading || settingsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          ) : (() => {
            const current = getCurrentMeal(messSettings, new Date())
            return (
              <div className="space-y-2.5">
                {MEAL_ORDER.map((mealKey) => {
                  const s = messSettings.find((s) => s.meal_type === mealKey)
                  if (s && !s.enabled) return null
                  const counts   = mealCounts?.[mealKey]
                  const isActive = current?.meal.meal_type === mealKey && current.status === 'active'
                  const isNext   = current?.meal.meal_type === mealKey && current.status === 'next'
                  const highlight = isActive || isNext
                  return (
                    <div key={mealKey} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isActive ? 'bg-success' :
                        isNext   ? 'bg-warning' :
                                   'bg-transparent'
                      }`} />
                      <p className={`text-[13px] flex-1 capitalize ${
                        highlight ? 'font-bold text-text-primary' : 'text-text-secondary'
                      }`}>
                        {mealKey}
                      </p>
                      <p className={`text-[13px] tabular-nums ${
                        highlight ? 'font-bold text-text-primary' : 'text-text-secondary'
                      }`}>
                        {counts ? `${counts.expected} / ${counts.total}` : '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
```

- [ ] **Step 5: Add "Mess Settings" to the warden quick-action list**

Find the quick-action array in `ManagerDashboardPage.tsx` (around line 330–335):

```typescript
            {[
              { label: 'Post Notice',    path: '/community',        icon: '📢' },
              { label: 'Edit Menu',      path: '/mess/menu-editor', icon: '🍽️' },
              { label: 'Payments',       path: '/manager/payments', icon: '💳' },
              { label: 'Leave Requests', path: '/manager/leave',    icon: '🗓️' },
```

Add `Mess Settings` after `Edit Menu`:

```typescript
            {[
              { label: 'Post Notice',    path: '/community',        icon: '📢' },
              { label: 'Edit Menu',      path: '/mess/menu-editor', icon: '🍽️' },
              { label: 'Mess Settings',  path: '/mess/settings',    icon: '⚙️' },
              { label: 'Payments',       path: '/manager/payments', icon: '💳' },
              { label: 'Leave Requests', path: '/manager/leave',    icon: '🗓️' },
```

- [ ] **Step 6: Build check**

```
npm run build
```

Expected: clean build. Common mistakes:
- If `mess` variable is referenced elsewhere in the file after removal, replace with `mealCounts`.
- If `messLoading` is referenced, replace with `mealCountsLoading`.
- The IIFE `(() => { ... })()` inside JSX is valid TSX — don't unwrap it without adding an intermediate variable.

- [ ] **Step 7: Manual browser check**

Log in as warden/manager. Verify:
1. Mess Today card shows three rows (Breakfast, Lunch, Dinner) with `expected / total` counts.
2. At the current time, the correct meal has a coloured dot (green = active, amber = next).
3. At 2:30 AM, the card shows a green or amber dot on Breakfast (the next meal) — not Dinner.
4. The "Mess Settings" quick action appears and navigates to `/mess/settings`.

- [ ] **Step 8: Commit**

```bash
git add src/features/dashboard/pages/ManagerDashboardPage.tsx
git commit -m "feat: replace mess occupancy card with all-meal counts + current meal highlight"
```
