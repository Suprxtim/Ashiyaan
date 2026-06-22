# Student Join Approval Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate student hostel access behind manager approval, and remove the "apply for leave" button from the manager's profile page.

**Architecture:** Use the existing `is_active` boolean on `profiles` to represent pending state (`hostel_id` set, `is_active = false`). A new migration modifies the join RPC and adds approve/reject RPCs. A new `/pending-approval` route is placed outside `OnboardingGuard` so pending students are blocked from the main app. Managers see a "Pending Members" section inline on their dashboard.

**Tech Stack:** React 19, react-router-dom v7, @tanstack/react-query v5, zustand v5, Supabase JS v2, Tailwind CSS v4, TypeScript 6, Vite 8.

## Global Constraints

- All new UI must use existing component primitives: `Button`, `Input`, `Skeleton`, `Badge` from `src/components/ui/`
- Styling: Tailwind utility classes only, matching the existing design tokens (`bg-canvas`, `bg-surface`, `text-text-primary`, `text-primary`, etc.)
- All Supabase queries follow the existing pattern: call → destructure `{ data, error }` → throw on error
- No new npm packages
- TypeScript strict — run `npx tsc --noEmit` after each task to verify

---

### Task 1: Supabase migration + database type updates

**Files:**
- Create: `supabase/migrations/011_join_approval.sql`
- Modify: `src/types/database.types.ts`

**Interfaces:**
- Produces:
  - `join_hostel_by_code(p_code)` now sets `is_active = false` on the joining student
  - `approve_join_request(p_user_id: uuid)` — sets `is_active = true`, only callable by manager/warden of same hostel
  - `reject_join_request(p_user_id: uuid)` — clears `hostel_id`, only callable by manager/warden of same hostel

---

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/011_join_approval.sql` with this exact content:

```sql
-- ============================================================
-- Migration 011: Student join approval flow
-- ============================================================

-- Modify join_hostel_by_code to set is_active = false so the
-- student lands in a pending state until a manager approves.
create or replace function join_hostel_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostel hostels;
begin
  select * into v_hostel
  from hostels
  where hostel_code = upper(trim(p_code));

  if not found then
    raise exception 'Invalid code. No place found with code %', p_code;
  end if;

  update profiles
  set hostel_id = v_hostel.id,
      is_active = false
  where id = auth.uid();

  return json_build_object(
    'id',            v_hostel.id,
    'name',          v_hostel.name,
    'hostel_code',   v_hostel.hostel_code,
    'property_type', v_hostel.property_type
  );
end;
$$;

-- Approve a pending student (manager/warden only, same hostel)
create or replace function approve_join_request(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role   user_role;
  v_caller_hostel uuid;
begin
  select role, hostel_id
  into v_caller_role, v_caller_hostel
  from profiles
  where id = auth.uid();

  if v_caller_role not in ('manager', 'warden') then
    raise exception 'Only managers and wardens can approve join requests';
  end if;

  update profiles
  set is_active = true
  where id        = p_user_id
    and hostel_id = v_caller_hostel
    and role      = 'student'
    and is_active = false;

  if not found then
    raise exception 'User not found or not a pending member of your hostel';
  end if;
end;
$$;

-- Reject a pending student — clears their hostel_id so they can retry
create or replace function reject_join_request(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role   user_role;
  v_caller_hostel uuid;
begin
  select role, hostel_id
  into v_caller_role, v_caller_hostel
  from profiles
  where id = auth.uid();

  if v_caller_role not in ('manager', 'warden') then
    raise exception 'Only managers and wardens can reject join requests';
  end if;

  update profiles
  set hostel_id = null,
      is_active = false
  where id        = p_user_id
    and hostel_id = v_caller_hostel
    and role      = 'student'
    and is_active = false;

  if not found then
    raise exception 'User not found or not a pending member of your hostel';
  end if;
end;
$$;

-- Enable realtime on profiles so PendingApprovalPage can subscribe
do $$
begin
  begin
    alter publication supabase_realtime add table profiles;
  exception when duplicate_object then
    null; -- already in publication, safe to ignore
  end;
end;
$$;
```

- [ ] **Step 2: Apply the migration to Supabase**

Option A — Supabase CLI (if local stack is running):
```bash
supabase db push
```
Expected: migration `011_join_approval` applied successfully.

Option B — Supabase MCP tool (if available in your environment):
Use the `mcp__supabase__apply_migration` tool with the SQL above as the content.

Verify in Supabase Dashboard → Database → Functions: you should see `approve_join_request` and `reject_join_request` listed, and `join_hostel_by_code` should now include `is_active = false` in its body.

- [ ] **Step 3: Add the new RPC signatures to `database.types.ts`**

Find the `Functions` block in `src/types/database.types.ts` (around line 1218). Add the two new entries:

```typescript
// In the Functions block, after the existing entries:
approve_join_request: {
  Args: { p_user_id: string }
  Returns: undefined
}
reject_join_request: {
  Args: { p_user_id: string }
  Returns: undefined
}
```

The full Functions block should then look like:
```typescript
Functions: {
  approve_join_request: {
    Args: { p_user_id: string }
    Returns: undefined
  }
  create_hostel_for_user: {
    Args: {
      p_city?: string
      p_contact_phone?: string
      p_name: string
      p_property_type?: Database["public"]["Enums"]["property_type"]
      p_state?: string
      p_total_rooms?: number
    }
    Returns: Json
  }
  expire_gate_passes: { Args: never; Returns: undefined }
  expire_visitors: { Args: never; Returns: undefined }
  generate_hostel_code: { Args: never; Returns: string }
  get_my_hostel_id: { Args: never; Returns: string }
  get_my_role: {
    Args: never
    Returns: Database["public"]["Enums"]["user_role"]
  }
  is_staff: { Args: never; Returns: boolean }
  join_hostel_by_code: { Args: { p_code: string }; Returns: Json }
  reject_join_request: {
    Args: { p_user_id: string }
    Returns: undefined
  }
  update_overdue_payments: { Args: never; Returns: undefined }
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/011_join_approval.sql src/types/database.types.ts
git commit -m "feat: add join approval RPCs and update DB types"
```

---

### Task 2: Update router guards + add `/pending-approval` route

**Files:**
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `PendingApprovalPage` (lazy import, created in Task 3)
- Produces:
  - `OnboardingPageGuard` redirects `hostel_id && !is_active` → `/pending-approval`
  - `OnboardingGuard` blocks `hostel_id && !is_active` → `/pending-approval`
  - New route `/pending-approval` placed inside `AuthGuard` but outside `OnboardingGuard`

---

- [ ] **Step 1: Add the lazy import for PendingApprovalPage**

In `src/router.tsx`, after the `OnboardingPage` lazy import (line 15), add:

```typescript
const PendingApprovalPage = lazy(() => import('@/features/auth/pages/PendingApprovalPage'))
```

- [ ] **Step 2: Update `OnboardingPageGuard`**

Replace the existing `OnboardingPageGuard` function (lines 97–102):

```typescript
// Before
function OnboardingPageGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (user?.profile.hostel_id) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
```

With:

```typescript
function OnboardingPageGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (user?.profile.hostel_id && user.profile.is_active) return <Navigate to="/dashboard" replace />
  if (user?.profile.hostel_id && !user.profile.is_active) return <Navigate to="/pending-approval" replace />
  return <Outlet />
}
```

- [ ] **Step 3: Update `OnboardingGuard`**

Replace the existing `OnboardingGuard` function (lines 87–93):

```typescript
// Before
function OnboardingGuard() {
  const { user, session, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (session && !user) return <Navigate to="/onboarding" replace />
  if (user && !user.profile.hostel_id) return <Navigate to='/onboarding' replace />
  return <Outlet />
}
```

With:

```typescript
function OnboardingGuard() {
  const { user, session, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (session && !user) return <Navigate to="/onboarding" replace />
  if (user && !user.profile.hostel_id) return <Navigate to="/onboarding" replace />
  if (user && user.profile.hostel_id && !user.profile.is_active) return <Navigate to="/pending-approval" replace />
  return <Outlet />
}
```

- [ ] **Step 4: Add the `/pending-approval` route**

Inside the `AuthGuard` children, after the `OnboardingPageGuard` block and **before** the `OnboardingGuard` block, add:

```typescript
// Pending approval — for students who joined but haven't been approved yet.
// Must be OUTSIDE OnboardingGuard (which would redirect them back here,
// causing a loop) and OUTSIDE AppShell (no bottom nav while waiting).
{
  element: <SuspenseOutlet />,
  children: [
    { path: '/pending-approval', element: <PendingApprovalPage /> },
  ],
},
```

The AuthGuard children section should now read (in order):
1. `OnboardingPageGuard` → `/onboarding`
2. `/pending-approval` ← **new**
3. `OnboardingGuard` → AppShell → all app routes

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: may get "cannot find module PendingApprovalPage" — that's fine, the file doesn't exist yet. All other errors should be 0. If you get other errors, fix them before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/router.tsx
git commit -m "feat: update router guards for pending-approval state"
```

---

### Task 3: Create PendingApprovalPage

**Files:**
- Create: `src/features/auth/pages/PendingApprovalPage.tsx`

**Interfaces:**
- Consumes:
  - `useAuthStore` from `@/store/auth.store` — `user`, `setUser`, `clear`
  - `supabase` from `@/lib/supabase`
  - `join_hostel_by_code` RPC (same call as in OnboardingPage)
  - UI: `Button` from `@/components/ui/Button`, `Input` from `@/components/ui/Input`
- Produces: Page at `/pending-approval`; on approval navigates to `/dashboard`; on retry re-submits the join RPC

---

- [ ] **Step 1: Create the file**

Create `src/features/auth/pages/PendingApprovalPage.tsx` with this content:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, XCircle, Hash, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@/types/app.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type PageStatus = 'pending' | 'rejected'

export default function PendingApprovalPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const setUser  = useAuthStore((s) => s.setUser)

  const [status,     setStatus]     = useState<PageStatus>('pending')
  const [retryCode,  setRetryCode]  = useState('')
  const [retryError, setRetryError] = useState('')
  const [loading,    setLoading]    = useState(false)

  const hostelName = user?.hostel?.name ?? 'your warden'

  // Fetches the latest profile from DB and updates the auth store.
  // Returns the updated AuthUser, or null if the fetch failed.
  async function refreshAndSet(userId: string): Promise<AuthUser | null> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, hostels(*)')
      .eq('id', userId)
      .single()
    if (!profile) return null
    const updated: AuthUser = {
      id:      authUser.id,
      email:   authUser.email,
      profile: profile as AuthUser['profile'],
      hostel:  (profile as unknown as { hostels: AuthUser['hostel'] }).hostels ?? null,
    }
    setUser(updated)
    return updated
  }

  useEffect(() => {
    if (!user) return
    const userId = user.id

    // Realtime subscription — fires immediately when the manager approves/rejects
    const channel = supabase
      .channel(`pending-approval-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'profiles',
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          const updated = payload.new as { is_active: boolean; hostel_id: string | null }
          if (updated.is_active) {
            await refreshAndSet(userId)
            toast.success("You've been approved! Welcome!")
            navigate('/dashboard')
          } else if (!updated.hostel_id) {
            await refreshAndSet(userId)
            setStatus('rejected')
          }
        }
      )
      .subscribe()

    // Polling fallback every 10 seconds in case realtime is unavailable
    const poll = setInterval(async () => {
      const latest = await refreshAndSet(userId)
      if (!latest) return
      if (latest.profile.is_active) {
        clearInterval(poll)
        toast.success("You've been approved! Welcome!")
        navigate('/dashboard')
      } else if (!latest.profile.hostel_id) {
        clearInterval(poll)
        setStatus('rejected')
      }
    }, 10_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRetry(e: React.FormEvent) {
    e.preventDefault()
    setRetryError('')
    setLoading(true)

    const { data, error: rpcErr } = await supabase
      .rpc('join_hostel_by_code', { p_code: retryCode.toUpperCase().trim() })

    if (rpcErr) {
      setRetryError(rpcErr.message.includes('Invalid code')
        ? 'Invalid code — double check with your warden.'
        : rpcErr.message)
      setLoading(false)
      return
    }

    if (!user) { setLoading(false); return }
    const updated = await refreshAndSet(user.id)
    setLoading(false)

    if (!updated) {
      setRetryError('Joined, but profile failed to load. Please refresh.')
      return
    }

    const result = data as { name: string }
    toast.success(`Request sent to ${result.name}!`)
    setStatus('pending')
    setRetryCode('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    useAuthStore.getState().clear()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 py-10">

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-primary rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-xl font-black">A</span>
        </div>
        <h1 className="text-[22px] font-bold text-text-primary">Ashiyaan</h1>
      </div>

      <div className="w-full max-w-sm space-y-4">

        {status === 'pending' ? (
          <div className="bg-surface rounded-card shadow-card p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-warning-light rounded-full flex items-center justify-center mx-auto">
              <Clock size={32} className="text-warning" />
            </div>
            <div>
              <p className="text-[20px] font-bold text-text-primary">Waiting for approval</p>
              <p className="text-[13px] text-text-secondary mt-1">
                Your request has been sent to{' '}
                <span className="font-semibold text-text-primary">{hostelName}</span>.
                The warden will approve or reject your request shortly.
              </p>
            </div>
            <div className="bg-canvas rounded-inner px-4 py-3">
              <p className="text-[12px] text-text-tertiary">
                You'll be let in as soon as your warden approves. This page checks automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-card shadow-card p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-danger-light rounded-full flex items-center justify-center mx-auto">
                <XCircle size={32} className="text-danger" />
              </div>
              <div>
                <p className="text-[20px] font-bold text-text-primary">Request not approved</p>
                <p className="text-[13px] text-text-secondary mt-1">
                  Your request was rejected. Try a different code or contact your warden.
                </p>
              </div>
            </div>
            <form onSubmit={handleRetry} className="space-y-3">
              <Input
                label="Place code"
                placeholder="e.g. SUN-281"
                value={retryCode}
                onChange={(e) => setRetryCode(e.target.value.toUpperCase())}
                leftIcon={<Hash size={16} />}
                required
                autoFocus
              />
              {retryError && (
                <div className="bg-danger-light rounded-inner px-3 py-2">
                  <p className="text-[13px] text-danger">{retryError}</p>
                </div>
              )}
              <Button type="submit" fullWidth variant="dark" loading={loading}>
                Try Again
              </Button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="text-[12px] text-text-secondary flex items-center gap-1.5 mx-auto hover:text-danger transition-colors"
        >
          <LogOut size={12} /> Log out
        </button>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/pages/PendingApprovalPage.tsx
git commit -m "feat: add PendingApprovalPage with realtime subscription"
```

---

### Task 4: Update OnboardingPage join flow

**Files:**
- Modify: `src/features/auth/pages/OnboardingPage.tsx`

**Interfaces:**
- Consumes: `refreshProfile()` (already defined in the file); result of `join_hostel_by_code` RPC
- Change: after a successful join, if the refreshed profile has `hostel_id` set but `is_active = false`, navigate to `/pending-approval` instead of `/dashboard`

---

- [ ] **Step 1: Update `handleJoin` in OnboardingPage**

In `src/features/auth/pages/OnboardingPage.tsx`, replace the `handleJoin` function (lines 75–100) with:

```typescript
async function handleJoin(e: React.FormEvent) {
  e.preventDefault()
  setError(''); setLoading(true)

  const { data, error: rpcErr } = await supabase
    .rpc('join_hostel_by_code', { p_code: code.toUpperCase().trim() })

  if (rpcErr) {
    setError(rpcErr.message.includes('Invalid code')
      ? 'Invalid code — double check with your warden or flatmate.'
      : rpcErr.message)
    setLoading(false); return
  }

  const ok = await refreshProfile()
  setLoading(false)
  if (!ok) {
    setError('Joined successfully, but your profile could not load. Tap to reload.')
    return
  }

  const { user: updatedUser } = useAuthStore.getState()

  // Student pending approval — warden hasn't approved yet
  if (updatedUser && !updatedUser.profile.is_active) {
    navigate('/pending-approval')
    return
  }

  const result = data as { name: string; property_type: string }
  toast.success(`Joined ${result.name}!`)
  const role = useAuthStore.getState().user?.profile.role
  navigate(role === 'warden' || role === 'manager' ? '/manager' : '/dashboard')
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Manual verification (dev server)**

```bash
npm run dev
```

1. Log in as a fresh student with no hostel.
2. Enter a valid place code on the onboarding screen.
3. Expected: redirected to `/pending-approval` (clock icon, "Waiting for approval").
4. Confirm you cannot navigate manually to `/dashboard` — the `OnboardingGuard` should redirect back to `/pending-approval`.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/pages/OnboardingPage.tsx
git commit -m "feat: redirect student to pending-approval after join"
```

---

### Task 5: Manager service functions + Pending Members dashboard section

**Files:**
- Modify: `src/services/manager.service.ts`
- Modify: `src/features/dashboard/pages/ManagerDashboardPage.tsx`

**Interfaces:**
- Produces:
  - `getPendingMembers(hostelId: string): Promise<PendingMember[]>`
  - `approveJoinRequest(userId: string): Promise<void>`
  - `rejectJoinRequest(userId: string): Promise<void>`

---

- [ ] **Step 1: Add the three service functions to `manager.service.ts`**

At the end of `src/services/manager.service.ts`, append:

```typescript
export interface PendingMember {
  id: string
  full_name: string
  phone: string | null
  created_at: string
}

export async function getPendingMembers(hostelId: string): Promise<PendingMember[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, created_at')
    .eq('hostel_id', hostelId)
    .eq('role', 'student')
    .eq('is_active', false)
    .order('created_at', { ascending: true })
  return (data ?? []) as PendingMember[]
}

export async function approveJoinRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_join_request', { p_user_id: userId })
  if (error) throw error
}

export async function rejectJoinRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_join_request', { p_user_id: userId })
  if (error) throw error
}
```

- [ ] **Step 2: Import the new functions in ManagerDashboardPage**

In `src/features/dashboard/pages/ManagerDashboardPage.tsx`, update the import from `@/services/manager.service` to include the new exports:

```typescript
import {
  getManagerStats, getMessOccupancy, getLiveGateMovements,
  getOpenComplaints, updateComplaintStatus, getPendingPayments,
  getManagerAnalytics,
  getPendingMembers, approveJoinRequest, rejectJoinRequest,
  type PendingMember,
} from '@/services/manager.service'
```

Also add `UserCheck` to the lucide-react import (for the pending members icon):

```typescript
import {
  Bell, LogOut, Users, AlertTriangle, IndianRupee,
  UtensilsCrossed, ChevronRight, CheckCircle2, Clock, Flame, ScanLine,
  Building2, TrendingUp, Timer, UserCheck,
} from 'lucide-react'
```

- [ ] **Step 3: Add the query and mutations inside `ManagerDashboardPage`**

Inside the `ManagerDashboardPage` function body, after the existing `analytics` query (line ~91), add:

```typescript
const { data: pendingMembers = [], isLoading: pendingLoading } = useQuery({
  queryKey:       ['pending-members', hostelId],
  queryFn:        () => getPendingMembers(hostelId),
  enabled:        !!hostelId,
  refetchInterval: 30_000,
})

const { mutate: approveMember, isPending: approving } = useMutation({
  mutationFn: (userId: string) => approveJoinRequest(userId),
  onSuccess: () => {
    toast.success('Member approved')
    qc.invalidateQueries({ queryKey: ['pending-members', hostelId] })
    qc.invalidateQueries({ queryKey: ['manager-stats', hostelId] })
  },
  onError: () => toast.error('Failed to approve member'),
})

const { mutate: rejectMember, isPending: rejecting } = useMutation({
  mutationFn: (userId: string) => rejectJoinRequest(userId),
  onSuccess: () => {
    toast.success('Request rejected')
    qc.invalidateQueries({ queryKey: ['pending-members', hostelId] })
  },
  onError: () => toast.error('Failed to reject request'),
})
```

- [ ] **Step 4: Add the Pending Members section in the JSX**

In the JSX of `ManagerDashboardPage`, inside the `<div className="px-4 pt-5 space-y-5">` container, insert the Pending Members section **as the very first child** (before the Stats Row):

```tsx
{/* ── Pending Members ── hidden when empty */}
{(pendingLoading || pendingMembers.length > 0) && (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <UserCheck size={18} className="text-warning" />
      <p className="text-[17px] font-bold text-text-primary">Pending Members</p>
      {!pendingLoading && (
        <span className="ml-auto text-[12px] font-semibold bg-warning-light text-warning px-2 py-0.5 rounded-pill">
          {pendingMembers.length}
        </span>
      )}
    </div>

    {pendingLoading ? (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-surface rounded-card shadow-card p-3 flex gap-3">
            <Skeleton circle className="w-10 h-10 flex-shrink-0" />
            <div className="flex-1"><Skeleton lines={2} /></div>
          </div>
        ))}
      </div>
    ) : (
      <div className="bg-surface rounded-card shadow-card overflow-hidden">
        {pendingMembers.map((member: PendingMember, idx: number) => (
          <div key={member.id}>
            {idx > 0 && <div className="h-px bg-border mx-4" />}
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                style={{ backgroundColor: getAvatarColor(member.full_name) }}
              >
                {getInitials(member.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-text-primary truncate">{member.full_name}</p>
                <p className="text-[12px] text-text-tertiary">Waiting · {timeAgo(member.created_at)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => rejectMember(member.id)}
                  disabled={rejecting || approving}
                  className="px-3 py-1.5 border border-border rounded-btn text-[12px] font-semibold text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => approveMember(member.id)}
                  disabled={approving || rejecting}
                  className="px-3 py-1.5 bg-primary rounded-btn text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-50"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Manual verification (dev server)**

1. As a student, enter a valid place code → land on `/pending-approval`.
2. Log in as a manager in a separate browser/incognito window.
3. Open the manager dashboard — a "Pending Members" section should appear at the top with the student's name.
4. Click **Accept** — student should be approved (they'll be redirected to `/dashboard` from the pending page within 10 seconds or instantly via realtime).
5. Test the **Reject** path: student enters code again → pending → manager rejects → student sees "Request not approved" screen → enters another code.
6. Confirm the section disappears when there are no pending members.

- [ ] **Step 7: Commit**

```bash
git add src/services/manager.service.ts src/features/dashboard/pages/ManagerDashboardPage.tsx
git commit -m "feat: add pending members section to manager dashboard"
```

---

### Task 6: ProfilePage — remove "apply for leave" for managers

**Files:**
- Modify: `src/features/profile/pages/ProfilePage.tsx`

**Interfaces:**
- Change: the "Outpass / Leave Requests" button (lines ~190–206) must only render for students

---

- [ ] **Step 1: Add role check to the leave requests button**

In `src/features/profile/pages/ProfilePage.tsx`, find the "Outpass / Leave Requests" section (~line 190):

```tsx
{/* ── Outpass / Leave Requests ── */}
{(propType === 'hostel' || propType === 'pg') && (
```

Change the condition to also check the user's role:

```tsx
{/* ── Outpass / Leave Requests ── */}
{(propType === 'hostel' || propType === 'pg') && user?.profile.role === 'student' && (
```

No other changes needed.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Manual verification**

1. Log in as a manager and go to `/profile`.
2. Confirm the "Outpass / Leave Requests" card is **not visible**.
3. Log in as a student in a hostel and go to `/profile`.
4. Confirm the "Outpass / Leave Requests" card **is visible**.

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/pages/ProfilePage.tsx
git commit -m "fix: hide apply-for-leave button from manager profile page"
```

---

## Final Verification Checklist

- [ ] Student enters code → lands on `/pending-approval` (not `/dashboard`)
- [ ] Pending student cannot manually navigate to any app route (always redirected back to `/pending-approval`)
- [ ] Manager sees "Pending Members" section on dashboard when students are waiting
- [ ] Manager can Accept → student gets through to `/dashboard`
- [ ] Manager can Reject → student sees rejection screen and can retry with a new code
- [ ] Section disappears from manager dashboard when no pending members
- [ ] Manager profile page no longer shows "Outpass / Leave Requests"
- [ ] Student profile page still shows "Outpass / Leave Requests"
- [ ] `npm run build` passes with 0 TypeScript errors
