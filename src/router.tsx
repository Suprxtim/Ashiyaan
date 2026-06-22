import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import type { PropertyType } from '@/types/app.types'

// ── Lazy pages ────────────────────────────────────────────────

const LandingPage = lazy(() => import('@/features/auth/pages/LandingPage'))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const SignupPage = lazy(() => import('@/features/auth/pages/SignupPage'))
const AuthCallbackPage = lazy(() => import('@/features/auth/pages/AuthCallbackPage'))
const OnboardingPage = lazy(() => import('@/features/auth/pages/OnboardingPage'))
const PendingApprovalPage = lazy(() => import('@/features/auth/pages/PendingApprovalPage'))

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))

const GatePassPage = lazy(() => import('@/features/gate-pass/pages/GatePassPage'))
const PassHistoryPage = lazy(() => import('@/features/gate-pass/pages/PassHistoryPage'))

const MessPage = lazy(() => import('@/features/mess/pages/MessPage'))
const MessBillPage = lazy(() => import('@/features/mess/pages/MessBillPage'))

const ComplaintsPage = lazy(() => import('@/features/complaints/pages/ComplaintsPage'))
const NewComplaintPage = lazy(() => import('@/features/complaints/pages/NewComplaintPage'))
const ComplaintDetailPage = lazy(() => import('@/features/complaints/pages/ComplaintDetailPage'))

const PaymentsPage = lazy(() => import('@/features/payments/pages/PaymentsPage'))

const EmergencyPage = lazy(() => import('@/features/emergency/pages/EmergencyPage'))

const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'))

const MyRoomPage = lazy(() => import('@/features/room/pages/MyRoomPage'))

const LeaveRequestsPage = lazy(() => import('@/features/leave/pages/LeaveRequestsPage'))
const NewLeaveRequestPage = lazy(() => import('@/features/leave/pages/NewLeaveRequestPage'))

const ManagerDashboardPage = lazy(() => import('@/features/dashboard/pages/ManagerDashboardPage'))
const ManagerComplaintsPage = lazy(() => import('@/features/complaints/pages/ManagerComplaintsPage'))
const ManagerLeaveRequestsPage = lazy(() => import('@/features/leave/pages/ManagerLeaveRequestsPage'))
const ManagerSosPage = lazy(() => import('@/features/emergency/pages/ManagerSosPage'))
const ExpensesPage = lazy(() => import('@/features/expenses/pages/ExpensesPage'))
const ScanPage = lazy(() => import('@/features/gate-pass/pages/ScanPage'))
const CommunityPage = lazy(() => import('@/features/community/pages/CommunityPage'))
const MessMenuEditorPage = lazy(() => import('@/features/mess/pages/MessMenuEditorPage'))
const ManagerPaymentsPage = lazy(() => import('@/features/payments/pages/ManagerPaymentsPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'))

// ── Root layout — initialises auth BEFORE any guard runs ─────

function RootLayout() {
  useAuth()
  return <Outlet />
}

// ── Guards ────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas">
      <Spinner size="lg" />
    </div>
  )
}

function AuthGuard() {
  const { session, isLoading } = useAuthStore()
  // Only block with a spinner if we don't know our auth state yet (no session at all).
  // If a session already exists, let the route render even while the profile refreshes.
  if (isLoading && !session) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

function GuestGuard() {
  const { session, isLoading } = useAuthStore()
  // Mirror AuthGuard: only block while session state is unknown.
  if (isLoading && !session) return <PageLoader />
  if (session) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Redirect logged-in users with no hostel to onboarding.
// Also catches the edge case where profile load failed (session but no user).
function OnboardingGuard() {
  const { user, session, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (session && !user) return <Navigate to="/onboarding" replace />
  if (user && !user.profile.hostel_id) return <Navigate to="/onboarding" replace />
  if (user && user.profile.hostel_id && !user.profile.is_active) return <Navigate to="/pending-approval" replace />
  return <Outlet />
}

// Prevent already-onboarded users from re-entering the onboarding flow and
// accidentally creating a second hostel or switching to a different one.
function OnboardingPageGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (user?.profile.hostel_id && user.profile.is_active) return <Navigate to="/dashboard" replace />
  if (user?.profile.hostel_id && !user.profile.is_active) return <Navigate to="/pending-approval" replace />
  return <Outlet />
}

function SuspenseOutlet() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  )
}

// Shows landing page for guests; redirects authenticated users to their dashboard.
function RootRedirect() {
  const { session, isLoading } = useAuthStore()
  if (isLoading && !session) return <PageLoader />
  if (session) return <Navigate to="/dashboard" replace />
  return (
    <Suspense fallback={<PageLoader />}>
      <LandingPage />
    </Suspense>
  )
}

// Redirect students away from manager/warden-only pages.
function StaffOnlyGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  const isStaff = user?.profile.role === 'warden' || user?.profile.role === 'manager'
  if (!isStaff) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Redirect users whose hostel's property type doesn't support a feature
// (e.g. PG residents have no Gate Pass, Shared apartments have no Mess).
function PropertyTypeGuard({ allow }: { allow: PropertyType[] }) {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  const propType = user?.hostel?.property_type ?? 'hostel'
  if (!allow.includes(propType)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ── Router ────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <RootRedirect /> },

      // Guest-only routes (redirect to /dashboard if already logged in)
      {
        element: <GuestGuard />,
        children: [
          {
            element: <SuspenseOutlet />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/signup', element: <SignupPage /> },
              { path: '/auth/callback', element: <AuthCallbackPage /> },
            ],
          },
        ],
      },

      // Authenticated routes (wrapped in AppShell)
      {
        element: <AuthGuard />,
        children: [
          // Onboarding — only for users who haven't joined/created a hostel yet
          {
            element: <OnboardingPageGuard />,
            children: [
              {
                element: <SuspenseOutlet />,
                children: [
                  { path: '/onboarding', element: <OnboardingPage /> },
                ],
              },
            ],
          },
          // Pending approval — for students who joined but haven't been approved yet.
          // Must be OUTSIDE OnboardingGuard (which would redirect them back here,
          // causing a loop) and OUTSIDE AppShell (no bottom nav while waiting).
          {
            element: <SuspenseOutlet />,
            children: [
              { path: '/pending-approval', element: <PendingApprovalPage /> },
            ],
          },
          {
            element: <OnboardingGuard />,
            children: [
              {
                element: <AppShell />,
                children: [
                  {
                    element: <SuspenseOutlet />,
                    children: [
                      // Student routes — available to every property type
                      { path: '/dashboard', element: <DashboardPage /> },
                      { path: '/complaints', element: <ComplaintsPage /> },
                      { path: '/complaints/new', element: <NewComplaintPage /> },
                      { path: '/complaints/:id', element: <ComplaintDetailPage /> },
                      { path: '/payments', element: <PaymentsPage /> },
                      { path: '/emergency', element: <EmergencyPage /> },
                      { path: '/profile', element: <ProfilePage /> },
                      { path: '/my-room', element: <MyRoomPage /> },
                      { path: '/community', element: <CommunityPage /> },
                      { path: '/notifications', element: <NotificationsPage /> },

                      // Gate Pass — hostel only (PG/Shared have no gate infrastructure)
                      {
                        element: <PropertyTypeGuard allow={['hostel']} />,
                        children: [
                          { path: '/gate-pass', element: <GatePassPage /> },
                          { path: '/gate-pass/history', element: <PassHistoryPage /> },
                        ],
                      },

                      // Mess — hostel + PG (Shared apartments don't have a mess)
                      {
                        element: <PropertyTypeGuard allow={['hostel', 'pg']} />,
                        children: [
                          { path: '/mess', element: <MessPage /> },
                          { path: '/mess/bill', element: <MessBillPage /> },
                        ],
                      },

                      // Outpass / Leave Requests — hostel + PG (Shared apartments have no warden to approve)
                      {
                        element: <PropertyTypeGuard allow={['hostel', 'pg']} />,
                        children: [
                          { path: '/leave', element: <LeaveRequestsPage /> },
                          { path: '/leave/new', element: <NewLeaveRequestPage /> },
                        ],
                      },

                      // Shared apartment expense splitting
                      {
                        element: <PropertyTypeGuard allow={['shared']} />,
                        children: [
                          { path: '/expenses', element: <ExpensesPage /> },
                        ],
                      },

                      // Manager/warden-only routes
                      {
                        element: <StaffOnlyGuard />,
                        children: [
                          { path: '/manager', element: <ManagerDashboardPage /> },
                          { path: '/manager/complaints', element: <ManagerComplaintsPage /> },
                          { path: '/manager/sos', element: <ManagerSosPage /> },
                          { path: '/manager/payments', element: <ManagerPaymentsPage /> },

                          // Security/warden QR scanner — hostel + shared (no gate infra for PG)
                          {
                            element: <PropertyTypeGuard allow={['hostel', 'shared']} />,
                            children: [
                              { path: '/scan', element: <ScanPage /> },
                            ],
                          },

                          // Mess menu editor — hostel + PG (mirrors student Mess access)
                          {
                            element: <PropertyTypeGuard allow={['hostel', 'pg']} />,
                            children: [
                              { path: '/mess/menu-editor', element: <MessMenuEditorPage /> },
                              { path: '/manager/leave', element: <ManagerLeaveRequestsPage /> },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ]
          },   // closes OnboardingGuard
        ],
      },

      // Error routes
      { path: '/unauthorized', element: <div className="flex items-center justify-center min-h-screen"><p className="text-text-secondary">Access denied.</p></div> },
      { path: '*', element: <div className="flex items-center justify-center min-h-screen"><p className="text-text-secondary">Page not found.</p></div> },
    ]
  }  // closes RootLayout children
])
