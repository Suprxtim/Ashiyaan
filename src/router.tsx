import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'

// ── Lazy pages ────────────────────────────────────────────────

const LoginPage          = lazy(() => import('@/features/auth/pages/LoginPage'))
const SignupPage         = lazy(() => import('@/features/auth/pages/SignupPage'))
const AuthCallbackPage   = lazy(() => import('@/features/auth/pages/AuthCallbackPage'))
const OnboardingPage     = lazy(() => import('@/features/auth/pages/OnboardingPage'))

const DashboardPage   = lazy(() => import('@/features/dashboard/pages/DashboardPage'))

const GatePassPage    = lazy(() => import('@/features/gate-pass/pages/GatePassPage'))
const PassHistoryPage = lazy(() => import('@/features/gate-pass/pages/PassHistoryPage'))

const MessPage        = lazy(() => import('@/features/mess/pages/MessPage'))
const MessBillPage    = lazy(() => import('@/features/mess/pages/MessBillPage'))

const ComplaintsPage      = lazy(() => import('@/features/complaints/pages/ComplaintsPage'))
const NewComplaintPage    = lazy(() => import('@/features/complaints/pages/NewComplaintPage'))
const ComplaintDetailPage = lazy(() => import('@/features/complaints/pages/ComplaintDetailPage'))

const PaymentsPage    = lazy(() => import('@/features/payments/pages/PaymentsPage'))

const EmergencyPage   = lazy(() => import('@/features/emergency/pages/EmergencyPage'))

const ProfilePage     = lazy(() => import('@/features/profile/pages/ProfilePage'))

const ManagerDashboardPage    = lazy(() => import('@/features/dashboard/pages/ManagerDashboardPage'))
const ManagerComplaintsPage   = lazy(() => import('@/features/complaints/pages/ManagerComplaintsPage'))
const ExpensesPage         = lazy(() => import('@/features/expenses/pages/ExpensesPage'))
const ScanPage             = lazy(() => import('@/features/gate-pass/pages/ScanPage'))
const CommunityPage        = lazy(() => import('@/features/community/pages/CommunityPage'))
const MessMenuEditorPage      = lazy(() => import('@/features/mess/pages/MessMenuEditorPage'))
const ManagerPaymentsPage     = lazy(() => import('@/features/payments/pages/ManagerPaymentsPage'))
const NotificationsPage       = lazy(() => import('@/features/notifications/pages/NotificationsPage'))

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
  return <Outlet />
}

// Prevent already-onboarded users from re-entering the onboarding flow and
// accidentally creating a second hostel or switching to a different one.
function OnboardingPageGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (user?.profile.hostel_id) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function SuspenseOutlet() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  )
}

// ── Router ────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
  // Root redirect
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  // Guest-only routes (redirect to /dashboard if already logged in)
  {
    element: <GuestGuard />,
    children: [
      {
        element: <SuspenseOutlet />,
        children: [
          { path: '/login',          element: <LoginPage />         },
          { path: '/signup',         element: <SignupPage />        },
          { path: '/auth/callback',  element: <AuthCallbackPage />  },
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
      {
        element: <OnboardingGuard />,
        children: [
      {
        element: <AppShell />,
        children: [
          {
            element: <SuspenseOutlet />,
            children: [
              // Student routes
              { path: '/dashboard',             element: <DashboardPage /> },
              { path: '/gate-pass',             element: <GatePassPage /> },
              { path: '/gate-pass/history',     element: <PassHistoryPage /> },
              { path: '/mess',                  element: <MessPage /> },
              { path: '/mess/bill',             element: <MessBillPage /> },
              { path: '/complaints',            element: <ComplaintsPage /> },
              { path: '/complaints/new',        element: <NewComplaintPage /> },
              { path: '/complaints/:id',        element: <ComplaintDetailPage /> },
              { path: '/payments',              element: <PaymentsPage /> },
              { path: '/emergency',             element: <EmergencyPage /> },
              { path: '/profile',               element: <ProfilePage /> },

              // Shared apartment
              { path: '/expenses', element: <ExpensesPage /> },

              // Security/warden QR scanner
              { path: '/scan',      element: <ScanPage />      },
              { path: '/community',        element: <CommunityPage />      },
              { path: '/mess/menu-editor',    element: <MessMenuEditorPage />   },
              { path: '/manager/payments',    element: <ManagerPaymentsPage />  },
              { path: '/notifications',       element: <NotificationsPage />    },

              // Manager/warden routes
              { path: '/manager',             element: <ManagerDashboardPage />  },
              { path: '/manager/complaints', element: <ManagerComplaintsPage /> },
            ],
          },
        ],
      },
    ]},   // closes OnboardingGuard
    ],
  },

  // Error routes
  { path: '/unauthorized', element: <div className="flex items-center justify-center min-h-screen"><p className="text-text-secondary">Access denied.</p></div> },
  { path: '*',             element: <div className="flex items-center justify-center min-h-screen"><p className="text-text-secondary">Page not found.</p></div> },
  ]}  // closes RootLayout children
])
