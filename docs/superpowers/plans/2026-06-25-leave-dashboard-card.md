# Leave Status Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Leave Status Card to the student dashboard that shows the most recent non-cancelled leave request with inline Cancel for pending requests.

**Architecture:** Two-task delivery. Task 1 adds `fetchRecentLeave` to the service layer and cross-links the cancel invalidation so both the dashboard card and the full leave list stay in sync. Task 2 adds the card to `DashboardPage.tsx` as an inline component following the same pattern as `StatCard` and `QuickAction`. No new routes, no new files.

**Tech Stack:** React 19, @tanstack/react-query v5, Supabase JS v2, Tailwind CSS v4, TypeScript 6, lucide-react, sonner (toast)

## Global Constraints

- No new files — all changes go into existing files listed below.
- No new routes — navigation uses existing `/leave`, `/leave/new`.
- Card appears only for hostel and PG students (`!isShared && !isManager` in DashboardPage).
- Query key for the dashboard card: `['leave-recent', userId]` (string-array, userId second).
- `cancelLeaveRequest` signature: `cancelLeaveRequest(id: string, userId: string)` — imported from `src/services/leaveRequest.service.ts`.
- Date formatting: parse `YYYY-MM-DD` strings with split (never `new Date('YYYY-MM-DD')`) to avoid UTC offset shifting.
- No unit test framework — verification is TypeScript build (`npm run build`) + manual browser check.
- Commit after each task.

---

### Task 1: Service function + cross-invalidation

**Files:**
- Modify: `src/services/leaveRequest.service.ts`
- Modify: `src/features/leave/hooks/useLeaveRequests.ts`

**Interfaces:**
- Produces: `fetchRecentLeave(userId: string): Promise<LeaveRequest | null>` — exported from `leaveRequest.service.ts`, used by Task 2's `useQuery`.
- Produces: `useLeaveRequests().cancel` now also invalidates `['leave-recent']` so that cancelling from the full leave list immediately refreshes the dashboard card.

---

- [ ] **Step 1: Add `fetchRecentLeave` to the service**

Open `src/services/leaveRequest.service.ts`. After the `cancelLeaveRequest` function (line 57), add:

```typescript
export async function fetchRecentLeave(userId: string): Promise<LeaveRequest | null> {
  const { data } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
```

The query returns the most recent non-cancelled request, or `null` if none exists.

- [ ] **Step 2: Verify the file builds**

```
npm run build
```

Expected: no TypeScript errors. If there are errors, fix them before continuing.

- [ ] **Step 3: Add `['leave-recent']` invalidation to the cancel mutation in `useLeaveRequests`**

Open `src/features/leave/hooks/useLeaveRequests.ts`. Find the `cancel` mutation's `onSuccess` (lines 39–42). Replace:

```typescript
    onSuccess: () => {
      toast.success('Leave request cancelled')
      qc.invalidateQueries({ queryKey: ['leave-requests', userId] })
    },
```

With:

```typescript
    onSuccess: () => {
      toast.success('Leave request cancelled')
      qc.invalidateQueries({ queryKey: ['leave-requests', userId] })
      qc.invalidateQueries({ queryKey: ['leave-recent'] })
    },
```

The partial key `['leave-recent']` matches `['leave-recent', userId]` in TanStack Query v5's prefix-matching invalidation, so any user's card cache is swept — correct behaviour since only the current user's cancel runs here.

- [ ] **Step 4: Verify build still passes**

```
npm run build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/services/leaveRequest.service.ts src/features/leave/hooks/useLeaveRequests.ts
git commit -m "feat: add fetchRecentLeave service fn + cross-invalidate dashboard cache on cancel"
```

---

### Task 2: Leave Status Card on Dashboard

**Files:**
- Modify: `src/features/dashboard/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `fetchRecentLeave(userId)` from Task 1.
- Consumes: `cancelLeaveRequest(id, userId)` — already exported from `leaveRequest.service.ts` (line 50).

---

- [ ] **Step 1: Update imports at the top of `DashboardPage.tsx`**

The file currently imports:
```typescript
import { useQuery } from '@tanstack/react-query'
import {
  Bell, QrCode, UtensilsCrossed, CreditCard, Receipt,
  LogIn, LogOut, ChevronRight, Utensils, AlertTriangle,
  IndianRupee, Wrench,
} from 'lucide-react'
```

Replace those two import statements with:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell, QrCode, UtensilsCrossed, CreditCard, Receipt,
  LogIn, LogOut, ChevronRight, Utensils, AlertTriangle,
  IndianRupee, Wrench, Calendar,
} from 'lucide-react'
```

Also add this import after the `dashboard.service` import line:
```typescript
import { fetchRecentLeave, cancelLeaveRequest, type LeaveRequest } from '@/services/leaveRequest.service'
```

The full import block at the top of the file should look like:

```typescript
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell, QrCode, UtensilsCrossed, CreditCard, Receipt,
  LogIn, LogOut, ChevronRight, Utensils, AlertTriangle,
  IndianRupee, Wrench, Calendar,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchDashboardStats, fetchAnnouncements, fetchRecentActivity, fetchRecentComplaints } from '@/services/dashboard.service'
import { fetchRecentLeave, cancelLeaveRequest, type LeaveRequest } from '@/services/leaveRequest.service'
import { getExpenses, getBalances } from '@/services/expenses.service'
import { formatCurrency, formatTime, getInitials, getAvatarColor, timeAgo } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import type { Announcement } from '@/types/app.types'
```

- [ ] **Step 2: Add the leave query and cancel mutation inside `DashboardPage`**

Inside `DashboardPage()`, after the existing `useQuery` hooks (after line 79, before the `if (isManager)` guard), add:

```typescript
  const qc = useQueryClient()

  const { data: recentLeave, isLoading: leaveLoading } = useQuery({
    queryKey: ['leave-recent', userId],
    queryFn:  () => fetchRecentLeave(userId),
    enabled:  !!userId && !isShared && !isManager,
  })

  const { mutate: cancelLeave, isPending: leaveCancelling } = useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(id, userId),
    onSuccess: () => {
      toast.success('Leave request cancelled')
      qc.invalidateQueries({ queryKey: ['leave-recent', userId] })
      qc.invalidateQueries({ queryKey: ['leave-requests', userId] })
    },
    onError: () => toast.error('Failed to cancel'),
  })
```

- [ ] **Step 3: Add the Leave / Outpass section to the JSX**

In the JSX, find the `{/* ── Announcements ── */}` comment (line 272). Insert the following block **immediately before** it (between the closing `</div>` of Quick Actions and the opening `<div>` of Announcements):

```tsx
        {/* ── Leave / Outpass ── */}
        {!isShared && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                Leave / Outpass
              </p>
              <button
                onClick={() => navigate('/leave')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            <LeaveCard
              request={recentLeave}
              isLoading={leaveLoading}
              cancelling={leaveCancelling}
              onCancel={cancelLeave}
              onNavigate={navigate}
            />
          </div>
        )}
```

- [ ] **Step 4: Add the `LeaveCard` inline component at the bottom of the file**

After the closing brace of `AnnouncementCard` (the last component, currently ending around line 530), add:

```tsx
function LeaveCard({
  request,
  isLoading,
  cancelling,
  onCancel,
  onNavigate,
}: {
  request: LeaveRequest | null | undefined
  isLoading: boolean
  cancelling: boolean
  onCancel: (id: string) => void
  onNavigate: (path: string) => void
}) {
  if (isLoading) {
    return (
      <div className="bg-surface rounded-card shadow-card p-4 flex items-center gap-3">
        <Skeleton circle className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1"><Skeleton lines={2} /></div>
      </div>
    )
  }

  const fmtDate = (d: string) => {
    const [, m, day] = d.split('-')
    return `${+day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]}`
  }

  if (!request) {
    return (
      <button
        onClick={() => onNavigate('/leave/new')}
        className="w-full bg-surface rounded-card shadow-card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
      >
        <div className="w-10 h-10 rounded-inner bg-primary-light flex items-center justify-center flex-shrink-0">
          <Calendar size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-text-primary">Outpass / Leave</p>
          <p className="text-[12px] text-text-tertiary">Plan a trip or overnight stay</p>
        </div>
        <span className="text-[13px] text-primary font-semibold flex-shrink-0">Apply →</span>
      </button>
    )
  }

  const dest      = request.destination ?? 'Leave'
  const dateRange = `${fmtDate(request.from_date)} – ${fmtDate(request.to_date)}`

  if (request.status === 'pending') {
    return (
      <div
        onClick={() => onNavigate('/leave')}
        className="bg-surface rounded-card shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-inner bg-warning-light flex items-center justify-center flex-shrink-0">
            <Calendar size={18} className="text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary truncate">Going to {dest}</p>
            <p className="text-[12px] text-text-tertiary">{dateRange}</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-warning-light text-warning flex-shrink-0">
            Pending
          </span>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(request.id) }}
            disabled={cancelling}
            className="text-[13px] text-danger font-semibold disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel Request'}
          </button>
        </div>
      </div>
    )
  }

  if (request.status === 'approved') {
    return (
      <div
        onClick={() => onNavigate('/leave')}
        className="bg-surface rounded-card shadow-card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="w-10 h-10 rounded-inner bg-success-light flex items-center justify-center flex-shrink-0">
          <Calendar size={18} className="text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-text-primary truncate">Going to {dest}</p>
          <p className="text-[12px] text-text-tertiary">{dateRange}</p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-success-light text-success flex-shrink-0">
          Approved ✓
        </span>
      </div>
    )
  }

  if (request.status === 'rejected') {
    return (
      <div
        onClick={() => onNavigate('/leave/new')}
        className="bg-surface rounded-card shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-inner bg-danger-light flex items-center justify-center flex-shrink-0">
            <Calendar size={18} className="text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">Leave Request</p>
            <p className="text-[12px] text-text-tertiary">{dateRange}</p>
            {request.review_note && (
              <p className="text-[12px] text-danger mt-0.5 line-clamp-1">{request.review_note}</p>
            )}
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-danger-light text-danger flex-shrink-0">
            Rejected
          </span>
        </div>
        <div className="mt-3 flex justify-end">
          <span className="text-[13px] text-primary font-semibold">Apply Again →</span>
        </div>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 5: TypeScript build check**

```
npm run build
```

Expected: clean build, no errors. Common mistakes to watch for:
- `recentLeave` type is `LeaveRequest | null | undefined` — `LeaveCard`'s `request` prop accepts this.
- `cancelLeave` from `useMutation` is `(id: string) => void` — matches `onCancel`.
- `navigate` from `useNavigate()` accepts `string` — matches `onNavigate`.

If you see `Property 'review_note' does not exist`, check `database.types.ts` for the exact column name on `leave_requests`.

- [ ] **Step 6: Manual browser check — all four card states**

Run `npm run dev`, open the student dashboard, and verify:

1. **No request state** — Log in as a student with no leave requests. Card shows "Outpass / Leave" with "Apply →" button. Tapping it navigates to `/leave/new`.
2. **Pending state** — Create a leave request from `/leave/new`. Return to dashboard. Card shows "Going to [destination]", date range, yellow "Pending" badge, and "Cancel Request" button.
3. **Cancel flow** — Tap "Cancel Request". Button shows "Cancelling…" while in-flight. On success, toast appears and card transitions to the "no request" state.
4. **Approved state** — As warden/manager, approve the request (or update the DB row directly). Student dashboard shows green "Approved ✓" badge. No cancel button.
5. **Rejected state** — Reject a request. Dashboard shows red "Rejected" badge, review note (if any), "Apply Again →" link.

Also verify the card does **not** appear for shared-apartment students (only hostel and PG).

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/pages/DashboardPage.tsx
git commit -m "feat: add Leave Status Card to student dashboard with inline cancel"
```
