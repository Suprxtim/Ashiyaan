# Student Roster & Room Assignment Design

**Date:** 2026-06-22
**Status:** Approved

---

## Problem

1. Managers have no way to view the list of students living in their hostel or see their full details.
2. Students have no way to record their academic, medical, and emergency contact information.
3. Room numbers cannot be assigned by the manager — students show "No room assigned" on their dashboard.

---

## Feature 1 — Extended Student Profile Fields

### New columns on `profiles` table

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `college_name` | `text` | Yes | Institution name |
| `course` | `text` | Yes | e.g. "B.Tech ECE", "MBBS" |
| `college_year` | `text` | Yes | e.g. "1st Year", "3rd Year" |
| `blood_group` | `text` | Yes | One of: A+, A−, B+, B−, AB+, AB−, O+, O−, Unknown |
| `date_of_birth` | `date` | Yes | |
| `aadhaar_number` | `text` | Yes | 12-digit Aadhaar |
| `hometown` | `text` | Yes | Native city/town |
| `parent_name` | `text` | Yes | Parent/guardian name |
| `parent_phone` | `text` | Yes | Parent/guardian phone |
| `allergies` | `text` | No | Free text; null if none |
| `medical_conditions` | `text` | No | Free text; null if none |
| `profile_completed` | `bool NOT NULL DEFAULT false` | — | Set to true on first profile completion |

`student_id` (enrollment/roll number) and `phone` already exist on `profiles`.

---

## Feature 2 — Profile Completion Flow (Student)

### When it triggers

After the manager approves a student (`is_active = true`), and before the student reaches `/dashboard` for the first time, they are redirected to `/complete-profile`. This is a one-time required screen.

**Guard logic** added to `OnboardingGuard` (after existing checks):
```
if user.profile.role === 'student'
  && user.profile.is_active
  && !user.profile.profile_completed
→ redirect to /complete-profile
```

### Route

`/complete-profile` — inside `AuthGuard`, outside `OnboardingGuard` (same pattern as `/pending-approval` to avoid redirect loops).

### Page: `ProfileCompletionPage`

Two-section form:

**Academic Details**
- College name (text input, required)
- Course / Branch (text input, required, placeholder "e.g. B.Tech ECE")
- Year of study (select: 1st Year / 2nd Year / 3rd Year / 4th Year / 5th Year / Other, required)
- Enrollment / Roll number (text input, required — maps to existing `student_id` column)

**Personal & Emergency**
- Date of birth (date input, required)
- Blood group (select: A+ / A− / B+ / B− / AB+ / AB− / O+ / O− / Unknown, required)
- Aadhaar number (text input, required, placeholder "12-digit number")
- Hometown (text input, required)
- Parent / Guardian name (text input, required)
- Parent / Guardian phone (text input, required)
- Allergies (text input, optional, placeholder "Leave blank if none")
- Medical conditions (text input, optional, placeholder "Leave blank if none")

On submit: updates all fields + sets `profile_completed = true` via a single `UPDATE` on `profiles`. Then navigates to `/dashboard`.

### Student Profile page edit

`ProfilePage.tsx` gets a new "Academic & Emergency Details" collapsible/scrollable section showing all the above fields in editable form (same fields, always editable after initial completion). Saves via direct `supabase.from('profiles').update(...)`.

---

## Feature 3 — Manager Students Page

### Navigation entry

A **"Students"** card added to `ManagerDashboardPage` alongside the existing stats cards. Tapping it navigates to `/manager/students`.

### Route: `/manager/students`

**File:** `src/features/dashboard/pages/ManagerStudentsPage.tsx`

**List view:**
- Search bar at top (client-side filter by name, real-time)
- Each row: avatar initials circle, full name, room number chip ("No room" in muted color if unassigned), course + year line
- Sorted alphabetically by `full_name`
- Tapping a row navigates to `/manager/students/:studentId`
- Empty state: "No students yet" (shown before any students have been approved)
- Query: `profiles` where `hostel_id = user.hostel.id`, `role = 'student'`, `is_active = true`

### Route: `/manager/students/:studentId`

**File:** `src/features/dashboard/pages/ManagerStudentDetailPage.tsx`

**Layout:** Back button → student name as page title.

**Read-only detail sections:**

*Personal*
- Full name, Phone, Date of birth, Blood group, Aadhaar number, Hometown

*Academic*
- College name, Course, Year of study, Enrollment number

*Emergency*
- Parent name, Parent phone, Allergies, Medical conditions

Any field not yet filled shows a muted **"Not filled"** placeholder so the manager can see what's missing.

**Room assignment section** (at the bottom of the page):
- Label: "Room Number"
- Text input pre-filled with current `room_number` (empty if unassigned)
- "Assign Room" button
- On submit: calls `assign_room(p_user_id, p_room_number)` RPC
- Success: updates local display, shows toast "Room assigned"
- Clearing the field and submitting sets `room_number` to null (unassigns)

### RPC: `assign_room(p_user_id uuid, p_room_number text)`

`security definer`, checks `is_staff()` and that the target student belongs to the caller's hostel. Sets `profiles.room_number = p_room_number`.

---

## Feature 4 — Room Number on Student Dashboard

No changes needed. `MyRoomPage` already reads `user.profile.room_number` from the store. After `assign_room` runs, the student's store will reflect the new room number the next time their profile refreshes (on next app load or session refresh).

To make it immediate: `PendingApprovalPage` already demonstrates the `refreshAndSet` pattern. We do not add realtime to room assignment — the student will see it on next login, which is acceptable for this use case.

---

## Files Touched

| File | Change |
|------|--------|
| `supabase/migrations/013_student_profile_fields.sql` | Add new columns + `assign_room` RPC |
| `src/types/database.types.ts` | Add new columns + `assign_room` RPC signature |
| `src/router.tsx` | Add `/complete-profile` route + guard in `OnboardingGuard` + `/manager/students` + `/manager/students/:studentId` |
| `src/features/auth/pages/ProfileCompletionPage.tsx` | New page |
| `src/features/profile/pages/ProfilePage.tsx` | Add editable academic/emergency section |
| `src/services/student.service.ts` | New — `getStudents`, `getStudentById`, `assignRoom` |
| `src/features/dashboard/pages/ManagerDashboardPage.tsx` | Add Students card |
| `src/features/dashboard/pages/ManagerStudentsPage.tsx` | New page |
| `src/features/dashboard/pages/ManagerStudentDetailPage.tsx` | New page |

---

## Out of Scope

- Bulk room assignment (assign multiple students at once)
- Room capacity enforcement (blocking assignment when room is full)
- Export student list to CSV/PDF
- Manager editing student details directly (students own their data)
- Realtime room number push to student dashboard (next-login refresh is acceptable)
