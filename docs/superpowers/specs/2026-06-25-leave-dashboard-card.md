# Leave Status Card — Student Dashboard

**Date:** 2026-06-25
**Status:** Approved

---

## Problem

Students have no entry point to leave requests / outpass from the home screen. They must navigate through Profile. The cancel option exists on `/leave` but is invisible to most students.

---

## Design

### Where it appears

Below the Quick Actions grid, above Announcements. Visible to hostel and PG students only (`propType !== 'shared'`, role `student`). Hidden for managers (they already redirect away).

### Data

New function `fetchRecentLeave(userId: string)` added to `src/services/leaveRequest.service.ts`:

```typescript
// Returns the most recent leave request that is not cancelled, or null.
export async function fetchRecentLeave(userId: string): Promise<LeaveRequest | null>
```

Query: `select('*').eq('user_id', userId).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle()`

`LeaveRequest` is the existing `Database['public']['Tables']['leave_requests']['Row']` type (already used by `getLeaveRequests`).

Query key on dashboard: `['leave-recent', userId]` — invalidated when `useLeaveRequests` cancels a request (via `qc.invalidateQueries({ queryKey: ['leave-recent'] })`).

### Cancel mutation

The dashboard card needs an inline Cancel button for pending requests. Rather than duplicating the mutation, the cancel RPC call is extracted:

`cancelLeaveRequest(id, userId)` already exists in `leaveRequest.service.ts` and is already used by `useLeaveRequests`. The dashboard uses `useMutation` directly with the same function — no new service code needed.

On cancel success: invalidate `['leave-recent', userId]` and `['leave-requests', userId]`.

### Card states

**No active request (data is null):**
```
[ Calendar icon ]  Outpass / Leave
                   Plan a trip or overnight stay
                                    [ Apply → ]
```
Tapping "Apply →" navigates to `/leave/new`.
Tapping anywhere else on the card navigates to `/leave`.

**Pending request:**
```
[ Calendar icon ]  Going to [destination or "Leave"]     [ Pending ]
                   [from_date] – [to_date]
                   [ Cancel Request ]   [ View All → ]
```
Cancel button uses the existing `cancelLeaveRequest` RPC. Loading spinner while `cancelling`.

**Approved request:**
```
[ Calendar icon ]  Going to [destination or "Leave"]     [ Approved ✓ ]
                   [from_date] – [to_date]
                                             [ View All → ]
```

**Rejected request:**
```
[ Calendar icon ]  Leave Request                          [ Rejected ]
                   [from_date] – [to_date]
                   [review_note if present]
                                             [ Apply Again → ]
```
"Apply Again" navigates to `/leave/new`.

### Loading state

Skeleton row (icon circle + 2 text lines) while `isLoading`.

### Section header

```
LEAVE / OUTPASS          View All →
```
"View All" navigates to `/leave`.

---

## Files

- **Modify:** `src/services/leaveRequest.service.ts` — add `fetchRecentLeave`
- **Modify:** `src/features/dashboard/pages/DashboardPage.tsx` — add query + `LeaveCard` component (defined inline in the same file, like `QuickAction` and `StatCard`)
- **Modify:** `src/features/leave/hooks/useLeaveRequests.ts` — add `qc.invalidateQueries({ queryKey: ['leave-recent'] })` on cancel success so dashboard updates instantly

---

## Out of Scope

- No changes to `LeaveRequestsPage.tsx` — cancel is already there
- No new routes
- No changes to manager dashboard
- No leave request creation form on dashboard (navigates to existing `/leave/new`)
