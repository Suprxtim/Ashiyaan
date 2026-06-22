# Student Roster & Room Assignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add extended student profile fields, a one-time profile completion screen after approval, a manager-facing student roster with search, per-student detail pages, and room number assignment that reflects in the student's dashboard.

**Architecture:** New `profiles` columns hold academic/medical/emergency data. A `ProfileCompletionPage` (outside `OnboardingGuard`, same pattern as `PendingApprovalPage`) captures this data once. A `student.service.ts` handles roster queries and room assignment via a new `assign_room` RPC. Two new manager pages (`ManagerStudentsPage` list + `ManagerStudentDetailPage`) sit inside the existing `StaffOnlyGuard`. `ProfilePage` gains an editable "Academic & Emergency Details" section for students.

**Tech Stack:** React 19, react-router-dom v7, @tanstack/react-query v5, zustand v5, Supabase JS v2, Tailwind CSS v4, TypeScript 6, Vite 8, lucide-react

## Global Constraints

- All new Supabase columns use `add column if not exists` to be safe.
- RPCs use `security definer` + `is_staff()` check (already used in `approve_join_request`, `assign_room` follows same pattern).
- `profiles.date_of_birth` is DB type `date`; TypeScript type is `string | null` (ISO date string `YYYY-MM-DD`).
- Blood group stored as text — accepted values: `"A+"`, `"A-"`, `"B+"`, `"B-"`, `"AB+"`, `"AB-"`, `"O+"`, `"O-"`, `"Unknown"`.
- College year stored as text — accepted values: `"1st Year"`, `"2nd Year"`, `"3rd Year"`, `"4th Year"`, `"5th Year"`, `"Other"`.
- `profile_completed` guard only applies to `role === 'student'`; wardens/managers skip it.
- `OnboardingGuard` check order: no-user → `/onboarding`, no-hostel → `/onboarding`, `hostel_id && !is_active` → `/pending-approval`, **NEW** `role=student && is_active && !profile_completed` → `/complete-profile`, else → Outlet.
- `/complete-profile` is placed **outside** `OnboardingGuard` (inside `AuthGuard`) — same pattern as `/pending-approval` — to prevent redirect loops.
- TypeScript check command: `npx tsc --noEmit` — must produce 0 errors after every task.
- No new npm packages; no changes to existing RLS policies.

---

### Task 1: DB migration + `database.types.ts`

**Files:**
- Create: `supabase/migrations/013_student_profile_fields.sql`
- Modify: `src/types/database.types.ts`

**Interfaces:**
- Produces: `profiles.Row` gains 12 new nullable fields + `profile_completed: boolean`; new `assign_room` RPC in `Functions` block. All later tasks rely on these types being present.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/013_student_profile_fields.sql`:

```sql
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
```

- [ ] **Step 2: Apply migration to Supabase**

Use the `mcp__supabase__apply_migration` tool:
- `name`: `013_student_profile_fields`
- `query`: contents of the SQL file above

- [ ] **Step 3: Update `profiles` Row type in `database.types.ts`**

In the `profiles` block, find the `Row` object (currently ends at `updated_at: string`). Add these fields in alphabetical order with the existing fields:

```typescript
// Add inside profiles.Row (alphabetical with existing fields):
aadhaar_number: string | null
allergies: string | null
blood_group: string | null
college_name: string | null
college_year: string | null
course: string | null
date_of_birth: string | null
hometown: string | null
medical_conditions: string | null
parent_name: string | null
parent_phone: string | null
profile_completed: boolean
```

The full updated `profiles.Row` block (replace the existing one):

```typescript
profiles: {
  Row: {
    aadhaar_number: string | null
    allergies: string | null
    avatar_url: string | null
    blood_group: string | null
    college_name: string | null
    college_year: string | null
    course: string | null
    created_at: string
    date_of_birth: string | null
    full_name: string
    hometown: string | null
    hostel_id: string | null
    id: string
    is_active: boolean
    medical_conditions: string | null
    parent_name: string | null
    parent_phone: string | null
    phone: string | null
    profile_completed: boolean
    role: Database["public"]["Enums"]["user_role"]
    room_number: string | null
    student_id: string | null
    updated_at: string
  }
  Insert: {
    aadhaar_number?: string | null
    allergies?: string | null
    avatar_url?: string | null
    blood_group?: string | null
    college_name?: string | null
    college_year?: string | null
    course?: string | null
    created_at?: string
    date_of_birth?: string | null
    full_name: string
    hometown?: string | null
    hostel_id?: string | null
    id: string
    is_active?: boolean
    medical_conditions?: string | null
    parent_name?: string | null
    parent_phone?: string | null
    phone?: string | null
    profile_completed?: boolean
    role?: Database["public"]["Enums"]["user_role"]
    room_number?: string | null
    student_id?: string | null
    updated_at?: string
  }
  Update: {
    aadhaar_number?: string | null
    allergies?: string | null
    avatar_url?: string | null
    blood_group?: string | null
    college_name?: string | null
    college_year?: string | null
    course?: string | null
    created_at?: string
    date_of_birth?: string | null
    full_name?: string
    hometown?: string | null
    hostel_id?: string | null
    id?: string
    is_active?: boolean
    medical_conditions?: string | null
    parent_name?: string | null
    parent_phone?: string | null
    phone?: string | null
    profile_completed?: boolean
    role?: Database["public"]["Enums"]["user_role"]
    room_number?: string | null
    student_id?: string | null
    updated_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "profiles_hostel_id_fkey"
      columns: ["hostel_id"]
      isOneToOne: false
      referencedRelation: "hostels"
      referencedColumns: ["id"]
    },
  ]
}
```

- [ ] **Step 4: Add `assign_room` to the `Functions` block**

In `database.types.ts`, find the `Functions` block. Add `assign_room` in alphabetical order (before `approve_join_request`):

```typescript
assign_room: {
  Args: { p_user_id: string; p_room_number: string }
  Returns: undefined
}
```

- [ ] **Step 5: Run type check**

```
npx tsc --noEmit
```

Expected: 0 errors (the new fields are all optional/nullable so nothing breaks).

- [ ] **Step 6: Commit**

```
git add supabase/migrations/013_student_profile_fields.sql src/types/database.types.ts
git commit -m "feat: add student profile fields and assign_room RPC"
```

---

### Task 2: Router guards + new routes

**Files:**
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `ProfileCompletionPage` (lazy — file created in Task 3), `ManagerStudentsPage` (Task 5), `ManagerStudentDetailPage` (Task 6).
- Produces: `/complete-profile` route accessible after auth; `OnboardingGuard` redirects pending-completion students there; `/manager/students` and `/manager/students/:studentId` routes inside `StaffOnlyGuard`.

- [ ] **Step 1: Add lazy imports**

In `src/router.tsx`, after the `PendingApprovalPage` lazy import line, add:

```typescript
const ProfileCompletionPage = lazy(() => import('@/features/auth/pages/ProfileCompletionPage'))
```

After the `ManagerDashboardPage` lazy import group, add:

```typescript
const ManagerStudentsPage = lazy(() => import('@/features/dashboard/pages/ManagerStudentsPage'))
const ManagerStudentDetailPage = lazy(() => import('@/features/dashboard/pages/ManagerStudentDetailPage'))
```

- [ ] **Step 2: Update `OnboardingGuard`**

Replace the existing `OnboardingGuard` function:

```typescript
function OnboardingGuard() {
  const { user, session, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (session && !user) return <Navigate to="/onboarding" replace />
  if (user && !user.profile.hostel_id) return <Navigate to="/onboarding" replace />
  if (user && user.profile.hostel_id && !user.profile.is_active) return <Navigate to="/pending-approval" replace />
  if (user && user.profile.role === 'student' && user.profile.is_active && !user.profile.profile_completed) {
    return <Navigate to="/complete-profile" replace />
  }
  return <Outlet />
}
```

- [ ] **Step 3: Add `/complete-profile` route**

In `src/router.tsx`, inside the `AuthGuard` children, after the `/pending-approval` block and before the `OnboardingGuard` block, add:

```typescript
// Profile completion — for newly approved students filling in academic/emergency details.
// Must be OUTSIDE OnboardingGuard (which would redirect them back here, causing a loop).
{
  element: <SuspenseOutlet />,
  children: [
    { path: '/complete-profile', element: <ProfileCompletionPage /> },
  ],
},
```

- [ ] **Step 4: Add manager student routes**

Inside the `StaffOnlyGuard` children `SuspenseOutlet`, after `{ path: '/manager', element: <ManagerDashboardPage /> }`, add:

```typescript
{ path: '/manager/students', element: <ManagerStudentsPage /> },
{ path: '/manager/students/:studentId', element: <ManagerStudentDetailPage /> },
```

- [ ] **Step 5: Run type check**

```
npx tsc --noEmit
```

Expected: errors for missing modules `ProfileCompletionPage`, `ManagerStudentsPage`, `ManagerStudentDetailPage` — these are fine until Tasks 3, 5, 6 create those files. The `profile_completed` field on the profile now type-checks ✓.

- [ ] **Step 6: Commit**

```
git add src/router.tsx
git commit -m "feat: add profile-completion guard and student roster routes"
```

---

### Task 3: `ProfileCompletionPage`

**Files:**
- Create: `src/features/auth/pages/ProfileCompletionPage.tsx`

**Interfaces:**
- Consumes: `supabase` client, `useAuthStore` (user, setUser), `Button` from `@/components/ui/Button`, `Input` from `@/components/ui/Input`, `AuthUser` from `@/types/app.types`.
- Produces: On submit, updates `profiles` with all 12 fields + `profile_completed = true`, refreshes auth store, navigates to `/dashboard`.

- [ ] **Step 1: Create the file**

Create `src/features/auth/pages/ProfileCompletionPage.tsx`:

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Heart, ArrowRight, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@/types/app.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const
const COLLEGE_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Other'] as const

export default function ProfileCompletionPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const setUser  = useAuthStore((s) => s.setUser)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    college_name:       '',
    course:             '',
    college_year:       '' as string,
    student_id:         user?.profile.student_id        ?? '',
    date_of_birth:      '',
    blood_group:        '' as string,
    aadhaar_number:     '',
    hometown:           '',
    parent_name:        '',
    parent_phone:       '',
    allergies:          '',
    medical_conditions: '',
  })

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        college_name:       form.college_name       || null,
        course:             form.course             || null,
        college_year:       form.college_year       || null,
        student_id:         form.student_id         || null,
        date_of_birth:      form.date_of_birth      || null,
        blood_group:        form.blood_group        || null,
        aadhaar_number:     form.aadhaar_number     || null,
        hometown:           form.hometown           || null,
        parent_name:        form.parent_name        || null,
        parent_phone:       form.parent_phone       || null,
        allergies:          form.allergies          || null,
        medical_conditions: form.medical_conditions || null,
        profile_completed:  true,
      })
      .eq('id', user!.id)

    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    // Refresh full profile (including hostels join) so store is accurate
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, hostels(*)')
        .eq('id', authUser.id)
        .single()
      if (profile) {
        setUser({
          id:      authUser.id,
          email:   authUser.email,
          profile: profile as AuthUser['profile'],
          hostel:  (profile as unknown as { hostels: AuthUser['hostel'] }).hostels ?? null,
        })
      }
    }

    setLoading(false)
    toast.success('Profile complete! Welcome to Ashiyaan.')
    navigate('/dashboard')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    useAuthStore.getState().clear()
    navigate('/login')
  }

  const selectClass =
    'w-full rounded-inner border border-border bg-surface px-3 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-start px-5 py-10">

      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-primary rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-xl font-black">A</span>
        </div>
        <h1 className="text-[22px] font-bold text-text-primary">Complete Your Profile</h1>
        <p className="text-[13px] text-text-secondary mt-1">
          Your warden needs these details before you can enter.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">

        {/* Academic Details */}
        <div className="bg-surface rounded-card shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={16} className="text-primary" />
            <p className="text-[15px] font-bold text-text-primary">Academic Details</p>
          </div>

          <Input
            label="College / University name"
            placeholder="e.g. Delhi University"
            value={form.college_name}
            onChange={setF('college_name')}
            required
          />
          <Input
            label="Course / Branch"
            placeholder="e.g. B.Tech ECE"
            value={form.course}
            onChange={setF('course')}
            required
          />

          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Year of study <span className="text-danger">*</span>
            </label>
            <select
              value={form.college_year}
              onChange={setF('college_year')}
              required
              className={selectClass}
            >
              <option value="" disabled>Select year</option>
              {COLLEGE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <Input
            label="Enrollment / Roll number"
            placeholder="e.g. 2021CS1234"
            value={form.student_id}
            onChange={setF('student_id')}
            required
          />
        </div>

        {/* Personal & Emergency */}
        <div className="bg-surface rounded-card shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart size={16} className="text-danger" />
            <p className="text-[15px] font-bold text-text-primary">Personal & Emergency</p>
          </div>

          <Input
            label="Date of birth"
            type="date"
            value={form.date_of_birth}
            onChange={setF('date_of_birth')}
            required
          />

          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Blood group <span className="text-danger">*</span>
            </label>
            <select
              value={form.blood_group}
              onChange={setF('blood_group')}
              required
              className={selectClass}
            >
              <option value="" disabled>Select blood group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <Input
            label="Aadhaar number"
            placeholder="12-digit number"
            value={form.aadhaar_number}
            onChange={setF('aadhaar_number')}
            required
          />
          <Input
            label="Hometown / Native city"
            placeholder="e.g. Patna, Bihar"
            value={form.hometown}
            onChange={setF('hometown')}
            required
          />
          <Input
            label="Parent / Guardian name"
            placeholder="e.g. Ramesh Sharma"
            value={form.parent_name}
            onChange={setF('parent_name')}
            required
          />
          <Input
            label="Parent / Guardian phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.parent_phone}
            onChange={setF('parent_phone')}
            required
          />
          <Input
            label="Known allergies (optional)"
            placeholder="e.g. Penicillin, Peanuts"
            value={form.allergies}
            onChange={setF('allergies')}
          />
          <Input
            label="Medical conditions (optional)"
            placeholder="e.g. Asthma, Diabetes"
            value={form.medical_conditions}
            onChange={setF('medical_conditions')}
          />
        </div>

        {error && (
          <div className="bg-danger-light rounded-inner px-3 py-2">
            <p className="text-[13px] text-danger">{error}</p>
          </div>
        )}

        <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
          Save & Enter
        </Button>

        <button
          type="button"
          onClick={handleLogout}
          className="text-[12px] text-text-secondary flex items-center gap-1.5 mx-auto hover:text-danger transition-colors"
        >
          <LogOut size={12} /> Log out
        </button>

      </form>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```
npx tsc --noEmit
```

Expected: 0 errors. The module-not-found errors for `ManagerStudentsPage` and `ManagerStudentDetailPage` from Task 2 will still appear — those are resolved in Tasks 5 and 6.

- [ ] **Step 3: Manual test**

Start dev server (`npm run dev`). Sign in as a student whose profile has `is_active = true` and `profile_completed = false` (set manually in Supabase if needed). Confirm:
- App redirects to `/complete-profile`
- Both form sections render
- Submitting with all required fields saves to DB and navigates to `/dashboard`
- Refreshing the page after completion does NOT show `/complete-profile` again

- [ ] **Step 4: Commit**

```
git add src/features/auth/pages/ProfileCompletionPage.tsx
git commit -m "feat: add ProfileCompletionPage for post-approval student details"
```

---

### Task 4: `student.service.ts` + `ProfilePage` academic section

**Files:**
- Create: `src/services/student.service.ts`
- Modify: `src/features/profile/pages/ProfilePage.tsx`

**Interfaces:**
- Produces:
  - `getStudents(hostelId: string): Promise<StudentListItem[]>` — used by Task 5
  - `getStudentById(studentId: string): Promise<Profile | null>` — used by Task 6
  - `assignRoom(userId: string, roomNumber: string): Promise<void>` — used by Task 6

- [ ] **Step 1: Create `src/services/student.service.ts`**

```typescript
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/app.types'

export type StudentListItem = Pick<Profile,
  'id' | 'full_name' | 'room_number' | 'course' | 'college_year' | 'phone' | 'avatar_url'
>

export async function getStudentCount(hostelId: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('role', 'student')
    .eq('is_active', true)
  if (error) throw error
  return count ?? 0
}

export async function getStudents(hostelId: string): Promise<StudentListItem[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, room_number, course, college_year, phone, avatar_url')
    .eq('hostel_id', hostelId)
    .eq('role', 'student')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as StudentListItem[]
}

export async function getStudentById(studentId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .eq('role', 'student')
    .single()
  if (error) throw error
  return data as Profile | null
}

export async function assignRoom(userId: string, roomNumber: string): Promise<void> {
  const { error } = await supabase.rpc('assign_room', {
    p_user_id: userId,
    p_room_number: roomNumber,
  })
  if (error) throw error
}
```

- [ ] **Step 2: Add academic/emergency section state to `ProfilePage`**

In `src/features/profile/pages/ProfilePage.tsx`, add imports and state. At the top, add `GraduationCap, Heart, Droplet` to the lucide-react import. Then inside `ProfilePage`, after the existing state declarations (`editing`, `saving`, `fullName`, `phone`), add:

```typescript
const [editingDetails,  setEditingDetails]  = useState(false)
const [savingDetails,   setSavingDetails]   = useState(false)
const [details, setDetails] = useState({
  college_name:       user?.profile.college_name       ?? '',
  course:             user?.profile.course             ?? '',
  college_year:       user?.profile.college_year       ?? '',
  student_id:         user?.profile.student_id         ?? '',
  date_of_birth:      user?.profile.date_of_birth      ?? '',
  blood_group:        user?.profile.blood_group        ?? '',
  aadhaar_number:     user?.profile.aadhaar_number     ?? '',
  hometown:           user?.profile.hometown           ?? '',
  parent_name:        user?.profile.parent_name        ?? '',
  parent_phone:       user?.profile.parent_phone       ?? '',
  allergies:          user?.profile.allergies          ?? '',
  medical_conditions: user?.profile.medical_conditions ?? '',
})

function setD(k: keyof typeof details) {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDetails((d) => ({ ...d, [k]: e.target.value }))
}
```

- [ ] **Step 3: Add `handleSaveDetails` function to `ProfilePage`**

After the existing `handleSave` function, add:

```typescript
async function handleSaveDetails() {
  if (!user) return
  setSavingDetails(true)
  const { error } = await supabase
    .from('profiles')
    .update({
      college_name:       details.college_name       || null,
      course:             details.course             || null,
      college_year:       details.college_year       || null,
      student_id:         details.student_id         || null,
      date_of_birth:      details.date_of_birth      || null,
      blood_group:        details.blood_group        || null,
      aadhaar_number:     details.aadhaar_number     || null,
      hometown:           details.hometown           || null,
      parent_name:        details.parent_name        || null,
      parent_phone:       details.parent_phone       || null,
      allergies:          details.allergies          || null,
      medical_conditions: details.medical_conditions || null,
    })
    .eq('id', user.id)
  setSavingDetails(false)
  if (error) { toast.error('Failed to save'); return }
  setUser({
    ...user,
    profile: {
      ...user.profile,
      college_name:       details.college_name       || null,
      course:             details.course             || null,
      college_year:       details.college_year       || null,
      student_id:         details.student_id         || null,
      date_of_birth:      details.date_of_birth      || null,
      blood_group:        details.blood_group        || null,
      aadhaar_number:     details.aadhaar_number     || null,
      hometown:           details.hometown           || null,
      parent_name:        details.parent_name        || null,
      parent_phone:       details.parent_phone       || null,
      allergies:          details.allergies          || null,
      medical_conditions: details.medical_conditions || null,
    },
  })
  toast.success('Details updated')
  setEditingDetails(false)
}
```

- [ ] **Step 4: Add academic/emergency section to `ProfilePage` render**

In the render, find the `{/* ── Outpass / Leave Requests ── */}` block. **Before** the `{/* ── Change place ── */}` block, insert the academic section for students only:

```tsx
{/* ── Academic & Emergency Details (students only) ── */}
{user?.profile.role === 'student' && (
  <div className="bg-surface rounded-card shadow-card overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
      <p className="text-[14px] font-semibold text-text-primary">Academic & Emergency Details</p>
      {!editingDetails && (
        <button
          onClick={() => setEditingDetails(true)}
          className="text-[13px] font-semibold text-primary"
        >
          Edit
        </button>
      )}
    </div>

    {!editingDetails ? (
      <div>
        <InfoRow icon={<GraduationCap size={16} />} label="College"    value={user.profile.college_name    ?? 'Not set'} />
        <InfoRow icon={<GraduationCap size={16} />} label="Course"     value={user.profile.course          ?? 'Not set'} />
        <InfoRow icon={<GraduationCap size={16} />} label="Year"       value={user.profile.college_year    ?? 'Not set'} />
        <InfoRow icon={<Hash size={16} />}          label="Enrollment" value={user.profile.student_id      ?? 'Not set'} />
        <InfoRow icon={<User size={16} />}          label="DOB"        value={user.profile.date_of_birth   ?? 'Not set'} />
        <InfoRow icon={<Droplet size={16} />}       label="Blood"      value={user.profile.blood_group     ?? 'Not set'} />
        <InfoRow icon={<Hash size={16} />}          label="Aadhaar"    value={user.profile.aadhaar_number  ?? 'Not set'} />
        <InfoRow icon={<MapPin size={16} />}        label="Hometown"   value={user.profile.hometown        ?? 'Not set'} />
        <InfoRow icon={<Phone size={16} />}         label="Parent"     value={user.profile.parent_name     ?? 'Not set'} />
        <InfoRow icon={<Phone size={16} />}         label="Parent Ph." value={user.profile.parent_phone    ?? 'Not set'} />
        {user.profile.allergies && (
          <InfoRow icon={<Heart size={16} />} label="Allergies"  value={user.profile.allergies} />
        )}
        {user.profile.medical_conditions && (
          <InfoRow icon={<Heart size={16} />} label="Medical"    value={user.profile.medical_conditions} last />
        )}
      </div>
    ) : (
      <div className="p-4 space-y-3">
        {(() => {
          const sel = 'w-full rounded-inner border border-border bg-surface px-3 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'
          return (
            <>
              <Input label="College name"          value={details.college_name}       onChange={setD('college_name')}       placeholder="e.g. Delhi University" />
              <Input label="Course / Branch"       value={details.course}             onChange={setD('course')}             placeholder="e.g. B.Tech ECE" />
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Year of study</label>
                <select value={details.college_year} onChange={setD('college_year')} className={sel}>
                  <option value="">Select year</option>
                  {['1st Year','2nd Year','3rd Year','4th Year','5th Year','Other'].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <Input label="Enrollment / Roll no." value={details.student_id}         onChange={setD('student_id')}         placeholder="e.g. 2021CS1234" />
              <Input label="Date of birth"         type="date" value={details.date_of_birth}  onChange={setD('date_of_birth')} />
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Blood group</label>
                <select value={details.blood_group} onChange={setD('blood_group')} className={sel}>
                  <option value="">Select</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <Input label="Aadhaar number"        value={details.aadhaar_number}     onChange={setD('aadhaar_number')}     placeholder="12-digit number" />
              <Input label="Hometown"              value={details.hometown}           onChange={setD('hometown')}           placeholder="e.g. Patna, Bihar" />
              <Input label="Parent name"           value={details.parent_name}        onChange={setD('parent_name')}        placeholder="e.g. Ramesh Sharma" />
              <Input label="Parent phone"          type="tel" value={details.parent_phone}  onChange={setD('parent_phone')}  placeholder="+91 98765 43210" />
              <Input label="Allergies (optional)"  value={details.allergies}          onChange={setD('allergies')}          placeholder="e.g. Penicillin" />
              <Input label="Medical (optional)"    value={details.medical_conditions} onChange={setD('medical_conditions')} placeholder="e.g. Asthma" />
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" fullWidth onClick={() => setEditingDetails(false)}>Cancel</Button>
                <Button variant="dark"      fullWidth loading={savingDetails} onClick={handleSaveDetails}>Save</Button>
              </div>
            </>
          )
        })()}
      </div>
    )}
  </div>
)}
```

Note: `MapPin` needs to be added to the lucide-react import if not already present. Check the existing imports — if `MapPin` is missing, add it.

- [ ] **Step 5: Run type check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Manual test**

Sign in as a student. Navigate to `/profile`. Confirm the "Academic & Emergency Details" section appears. Tap Edit, update a field, Save — confirm it persists on page reload. Confirm the section does NOT appear when signed in as a warden/manager.

- [ ] **Step 7: Commit**

```
git add src/services/student.service.ts src/features/profile/pages/ProfilePage.tsx
git commit -m "feat: add student service and academic/emergency section to ProfilePage"
```

---

### Task 5: `ManagerStudentsPage`

**Files:**
- Create: `src/features/dashboard/pages/ManagerStudentsPage.tsx`

**Interfaces:**
- Consumes: `getStudents` from `src/services/student.service.ts`, `useAuthStore`, `TopBar` from `@/components/layout/TopBar`, `getInitials` + `getAvatarColor` from `@/lib/utils`.
- Produces: `/manager/students` page rendering a searchable list of active students. Tapping a row navigates to `/manager/students/:studentId`.

- [ ] **Step 1: Create the file**

Create `src/features/dashboard/pages/ManagerStudentsPage.tsx`:

```typescript
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronRight, Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getStudents } from '@/services/student.service'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ManagerStudentsPage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const hostelId  = user?.profile.hostel_id ?? ''

  const [q, setQ] = useState('')

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['manager-students', hostelId],
    queryFn:  () => getStudents(hostelId),
    enabled:  !!hostelId,
  })

  const filtered = useMemo(() => {
    if (!q.trim()) return students
    const lower = q.toLowerCase()
    return students.filter((s) =>
      s.full_name.toLowerCase().includes(lower)
    )
  }, [students, q])

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Students" />

      <div className="pt-14 px-4 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full bg-surface rounded-inner border border-border pl-9 pr-4 py-2.5 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 bg-surface-raised rounded-full flex items-center justify-center">
              <Users size={24} className="text-text-tertiary" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-text-primary">
                {q ? 'No students found' : 'No students yet'}
              </p>
              <p className="text-[13px] text-text-secondary mt-0.5">
                {q ? 'Try a different name' : 'Approved students will appear here'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            {filtered.map((s, i) => {
              const initials    = getInitials(s.full_name)
              const avatarColor = getAvatarColor(s.full_name)
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/manager/students/${s.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-canvas transition-colors ${i < filtered.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-primary truncate">{s.full_name}</p>
                    <p className="text-[12px] text-text-secondary truncate">
                      {[s.course, s.college_year].filter(Boolean).join(' · ') || 'Profile incomplete'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.room_number ? (
                      <span className="px-2 py-0.5 bg-primary-light rounded-pill text-[11px] font-semibold text-primary">
                        Room {s.room_number}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-surface-raised rounded-pill text-[11px] font-medium text-text-tertiary">
                        No room
                      </span>
                    )}
                    <ChevronRight size={14} className="text-text-tertiary" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!isLoading && students.length > 0 && (
          <p className="text-[12px] text-text-tertiary text-center">
            {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
          </p>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```
npx tsc --noEmit
```

Expected: 0 errors (the `ManagerStudentDetailPage` module-not-found from Task 2 still present until Task 6).

- [ ] **Step 3: Manual test**

Sign in as manager/warden. Navigate to `/manager/students`. Confirm:
- Students from the hostel appear in the list
- Search bar filters by name in real time
- Room number chip shows or "No room" badge
- Tapping a row navigates to `/manager/students/:id`

- [ ] **Step 4: Commit**

```
git add src/features/dashboard/pages/ManagerStudentsPage.tsx
git commit -m "feat: add ManagerStudentsPage with search"
```

---

### Task 6: `ManagerStudentDetailPage`

**Files:**
- Create: `src/features/dashboard/pages/ManagerStudentDetailPage.tsx`

**Interfaces:**
- Consumes: `getStudentById` + `assignRoom` from `src/services/student.service.ts`, `useParams` from `react-router-dom`, `useMutation` + `useQuery` from `@tanstack/react-query`, `TopBar`, `Button`, `Input`.

- [ ] **Step 1: Create the file**

Create `src/features/dashboard/pages/ManagerStudentDetailPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Phone, GraduationCap, Heart, Home, Droplet,
  Hash, MapPin, BedDouble,
} from 'lucide-react'
import { toast } from 'sonner'
import { getStudentById, assignRoom } from '@/services/student.service'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
      <span className="text-text-tertiary flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">{label}</p>
        <p className={`text-[14px] mt-0.5 ${value ? 'text-text-primary' : 'text-text-tertiary italic'}`}>
          {value || 'Not filled'}
        </p>
      </div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-canvas border-b border-border">
      <span className="text-text-secondary">{icon}</span>
      <p className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide">{title}</p>
    </div>
  )
}

export default function ManagerStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const qc = useQueryClient()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-detail', studentId],
    queryFn:  () => getStudentById(studentId!),
    enabled:  !!studentId,
  })

  const [roomInput, setRoomInput] = useState('')

  // Initialise room input once student data loads (useEffect avoids setting state during render)
  useEffect(() => {
    if (student) setRoomInput(student.room_number ?? '')
  }, [student?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: doAssignRoom, isPending: assignPending } = useMutation({
    mutationFn: () => assignRoom(studentId!, roomInput),
    onSuccess: () => {
      const label = roomInput.trim() ? `Room ${roomInput.trim()} assigned` : 'Room unassigned'
      toast.success(label)
      qc.invalidateQueries({ queryKey: ['student-detail', studentId] })
      qc.invalidateQueries({ queryKey: ['manager-students'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !student) {
    return (
      <div className="min-h-dvh bg-canvas pb-24">
        <TopBar title="Student Details" />
        <div className="pt-14 px-4 space-y-4">
          <div className="flex items-center gap-4 pt-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-48 rounded-card" />
        </div>
      </div>
    )
  }

  const initials    = getInitials(student.full_name)
  const avatarColor = getAvatarColor(student.full_name)

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title={student.full_name} />

      <div className="pt-14 px-4 space-y-4">

        {/* Avatar header */}
        <div className="flex items-center gap-4 pt-4 pb-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0 shadow-raised"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <div>
            <p className="text-[18px] font-bold text-text-primary">{student.full_name}</p>
            <p className="text-[13px] text-text-secondary mt-0.5">
              {[student.course, student.college_year].filter(Boolean).join(' · ') || 'Profile incomplete'}
            </p>
          </div>
        </div>

        {/* Personal */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <SectionTitle icon={<User size={14} />} title="Personal" />
          <DetailRow icon={<Phone size={14} />}   label="Phone"    value={student.phone} />
          <DetailRow icon={<User size={14} />}    label="DOB"      value={student.date_of_birth} />
          <DetailRow icon={<Droplet size={14} />} label="Blood Group" value={student.blood_group} />
          <DetailRow icon={<Hash size={14} />}    label="Aadhaar"  value={student.aadhaar_number} />
          <DetailRow icon={<MapPin size={14} />}  label="Hometown" value={student.hometown} />
        </div>

        {/* Academic */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <SectionTitle icon={<GraduationCap size={14} />} title="Academic" />
          <DetailRow icon={<GraduationCap size={14} />} label="College"    value={student.college_name} />
          <DetailRow icon={<GraduationCap size={14} />} label="Course"     value={student.course} />
          <DetailRow icon={<GraduationCap size={14} />} label="Year"       value={student.college_year} />
          <DetailRow icon={<Hash size={14} />}          label="Enrollment" value={student.student_id} />
        </div>

        {/* Emergency */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <SectionTitle icon={<Heart size={14} />} title="Emergency" />
          <DetailRow icon={<User size={14} />}  label="Parent Name"  value={student.parent_name} />
          <DetailRow icon={<Phone size={14} />} label="Parent Phone" value={student.parent_phone} />
          <DetailRow icon={<Heart size={14} />} label="Allergies"    value={student.allergies} />
          <DetailRow icon={<Heart size={14} />} label="Medical Conditions" value={student.medical_conditions} />
        </div>

        {/* Room Assignment */}
        <div className="bg-surface rounded-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BedDouble size={16} className="text-primary" />
            <p className="text-[15px] font-bold text-text-primary">Room Assignment</p>
          </div>
          <p className="text-[13px] text-text-secondary">
            {student.room_number
              ? `Currently assigned to Room ${student.room_number}. Enter a new number to change, or clear to unassign.`
              : 'No room assigned yet. Enter a room number to assign.'}
          </p>
          <Input
            label="Room number"
            placeholder="e.g. 101"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            leftIcon={<Home size={16} />}
          />
          <Button
            variant="dark"
            fullWidth
            loading={assignPending}
            onClick={() => doAssignRoom()}
          >
            {roomInput.trim() ? 'Assign Room' : 'Unassign Room'}
          </Button>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```
npx tsc --noEmit
```

Expected: 0 errors. All module-not-found errors from Task 2 are now resolved.

- [ ] **Step 3: Manual test**

Navigate to `/manager/students`. Click a student. Confirm:
- All detail sections render with "Not filled" fallback for empty fields
- Room assignment input pre-fills with current room (or blank)
- Typing a room number and clicking "Assign Room" succeeds and updates the display
- Clearing the room and clicking "Unassign Room" clears it
- After assigning, navigating back to the student list shows the updated room chip

- [ ] **Step 4: Commit**

```
git add src/features/dashboard/pages/ManagerStudentDetailPage.tsx
git commit -m "feat: add ManagerStudentDetailPage with room assignment"
```

---

### Task 7: Manager dashboard Students card

**Files:**
- Modify: `src/features/dashboard/pages/ManagerDashboardPage.tsx`

**Interfaces:**
- Consumes: existing `useQuery` for `manager-stats` (to show student count), existing `navigate` hook.

- [ ] **Step 1: Add Students count query**

In `ManagerDashboardPage.tsx`, add `getStudentCount` to the existing import from `@/services/student.service`:

Wait — `student.service` is not yet imported in this file. Add a new import line after the `manager.service` import:

```typescript
import { getStudentCount } from '@/services/student.service'
```

Then add a new query after the existing queries (no `supabase` import needed — it stays in the service):

```typescript
const { data: studentCount = 0 } = useQuery({
  queryKey: ['student-count', hostelId],
  queryFn:  () => getStudentCount(hostelId),
  enabled:  !!hostelId,
})
```

- [ ] **Step 2: Add Students navigation card to the dashboard render**

In the render, find the section that shows stats cards (the `<div className="grid grid-cols-2 gap-3">` or similar). Add a "Students" card **before** the existing stats grid. Place it right after the pending members section and before the stats cards:

```tsx
{/* ── Students ── */}
<button
  onClick={() => navigate('/manager/students')}
  className="w-full bg-surface rounded-card shadow-card px-4 py-3.5 flex items-center justify-between"
>
  <div className="flex items-center gap-3">
    <span className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
      <Users size={16} />
    </span>
    <div className="text-left">
      <p className="text-[14px] font-semibold text-text-primary">Students</p>
      <p className="text-[12px] text-text-tertiary">{studentCount} active resident{studentCount !== 1 ? 's' : ''}</p>
    </div>
  </div>
  <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
</button>
```

Make sure `ChevronRight` is imported from lucide-react (add it to the existing import if missing).

- [ ] **Step 3: Run type check**

```
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual test**

Sign in as manager. On the manager dashboard:
- "Students" card appears with correct active student count
- Tapping it navigates to `/manager/students`

- [ ] **Step 5: Commit**

```
git add src/features/dashboard/pages/ManagerDashboardPage.tsx
git commit -m "feat: add Students card to manager dashboard"
```
