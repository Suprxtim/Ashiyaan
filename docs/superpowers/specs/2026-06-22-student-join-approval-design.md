# Student Join Approval Flow & Manager Profile Fix

**Date:** 2026-06-22  
**Status:** Approved

---

## Problem

1. Students enter a place code and immediately join the hostel with no manager oversight.
2. The manager's profile page shows an "Outpass / Leave Requests" (apply for leave) button that is only relevant to students.

---

## Feature 1 — Student Join Approval Flow

### Approach

Use the existing `is_active` boolean on the `profiles` table to represent pending state:

| `hostel_id` | `is_active` | Meaning                  |
|-------------|-------------|--------------------------|
| `null`      | `false`     | Not joined yet           |
| set         | `false`     | **Pending approval**     |
| set         | `true`      | Active member            |

On rejection, `hostel_id` is cleared back to `null` and `is_active` stays `false`, allowing the student to try again.

### Database Changes

- **Modify `join_hostel_by_code` RPC:** Set `is_active = false` on the student's profile instead of leaving the default `true`. Returns the hostel name as before.
- **New RPC `approve_join_request(p_user_id uuid)`:** Sets `is_active = true` for the given profile (scoped to the calling manager's hostel).
- **New RPC `reject_join_request(p_user_id uuid)`:** Sets `hostel_id = null`, `is_active = false` for the given profile (scoped to calling manager's hostel).
- **`database.types.ts`:** Add the two new RPCs to the `Functions` type block.

### Routing Changes (`router.tsx`)

Route tree after changes:
```
AuthGuard
├── OnboardingPageGuard → /onboarding
├── /pending-approval          ← NEW (outside OnboardingGuard to avoid redirect loop)
└── OnboardingGuard → AppShell → all app routes
```

**`OnboardingPageGuard`** (prevents onboarded users re-entering onboarding):
- Before: if `hostel_id` set → `/dashboard`
- After: if `hostel_id` set AND `is_active = true` → `/dashboard`; if `hostel_id` set AND `is_active = false` → `/pending-approval`

**`OnboardingGuard`** (forces unboarded users to onboarding, now also blocks pending students):
- Before: if no `hostel_id` → `/onboarding`
- After (in order): if no user → `/onboarding`; if no `hostel_id` → `/onboarding`; if `hostel_id` set AND `is_active = false` → `/pending-approval` ← **NEW**; else → Outlet

This prevents pending students from manually navigating to `/dashboard` or any other app route.

**New route `/pending-approval`** placed inside `AuthGuard` but **outside** `OnboardingGuard` (avoids redirect loop since `OnboardingGuard` now redirects `is_active=false` users to this very path).

### New Page — `PendingApprovalPage` (`src/features/auth/pages/PendingApprovalPage.tsx`)

- Displays hostel name and a "waiting for warden approval" message.
- Subscribes to Supabase Realtime on the user's own profile row (`profiles` where `id = user.id`).
- **On `is_active → true`:** call `refreshProfile()`, toast "You've been approved!", navigate to `/dashboard`.
- **On `hostel_id → null`:** show rejection state — "Your request was not approved." with a place-code input field to try again. Submitting calls `join_hostel_by_code` and refreshes profile, looping back to waiting state.
- Log out button always visible.

### OnboardingPage Changes

- After `handleJoin` succeeds, `refreshProfile()` runs as before.
- If `hostel_id` is set but `is_active = false` → `navigate('/pending-approval')`.
- If `hostel_id` is set and `is_active = true` → existing flow (navigate to `/dashboard` or `/manager`).

### Manager Dashboard Changes (`ManagerDashboardPage.tsx`)

- New **"Pending Members"** section, rendered above existing stats cards.
- Query: `profiles` where `hostel_id = user.hostel.id`, `is_active = false`, `role = 'student'`.
- Each row: student full name + **Accept** button (calls `approve_join_request`) + **Reject** button (calls `reject_join_request`).
- Section hidden entirely when the pending list is empty.
- New service function `getPendingMembers(hostelId)` in `manager.service.ts`.
- New service functions `approveJoinRequest(userId)` and `rejectJoinRequest(userId)` in `manager.service.ts`.

---

## Feature 2 — Manager Profile: Remove "Apply for Leave" Button

**File:** `src/features/profile/pages/ProfilePage.tsx` line ~190

**Change:** Add a role check so the "Outpass / Leave Requests" button only renders for students.

```tsx
// Before
{(propType === 'hostel' || propType === 'pg') && (

// After
{(propType === 'hostel' || propType === 'pg') && user?.profile.role === 'student' && (
```

Managers and wardens access leave management via `/manager/leave` on their own dashboard, not via the profile page.

---

## Files Touched

| File | Change |
|------|--------|
| Supabase migration (new) | Modify `join_hostel_by_code`, add `approve_join_request`, `reject_join_request` RPCs |
| `src/types/database.types.ts` | Add new RPC signatures |
| `src/router.tsx` | Update `OnboardingPageGuard`, `OnboardingGuard`, add `/pending-approval` route |
| `src/features/auth/pages/PendingApprovalPage.tsx` | New page |
| `src/features/auth/pages/OnboardingPage.tsx` | Navigate to `/pending-approval` when `is_active = false` |
| `src/services/manager.service.ts` | Add `getPendingMembers`, `approveJoinRequest`, `rejectJoinRequest` |
| `src/features/dashboard/pages/ManagerDashboardPage.tsx` | Add Pending Members section |
| `src/features/profile/pages/ProfilePage.tsx` | Add role check on leave button |

---

## Out of Scope

- Push notifications to student on approval/rejection (can be added later).
- Pagination of the pending members list.
- Manager ability to deactivate existing active students.
