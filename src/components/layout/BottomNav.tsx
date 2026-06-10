import { NavLink } from 'react-router-dom'
import {
  Home, QrCode, UtensilsCrossed, Wrench,
  LayoutDashboard, ScanLine, Receipt, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

const HOSTEL_TABS = [
  { label: 'Home',       path: '/dashboard',  Icon: Home            },
  { label: 'Gate Pass',  path: '/gate-pass',  Icon: QrCode          },
  { label: 'Mess',       path: '/mess',       Icon: UtensilsCrossed },
  { label: 'Complaints', path: '/complaints', Icon: Wrench          },
  { label: 'Profile',    path: '/profile',    Icon: User            },
]

// PG: same as hostel but no Gate Pass — landlord-managed PGs typically have
// no security desk / QR scanner for entry-exit logging.
const PG_TABS = [
  { label: 'Home',       path: '/dashboard',  Icon: Home            },
  { label: 'Mess',       path: '/mess',       Icon: UtensilsCrossed },
  { label: 'Complaints', path: '/complaints', Icon: Wrench          },
  { label: 'Profile',    path: '/profile',    Icon: User            },
]

const SHARED_TABS = [
  { label: 'Home',       path: '/dashboard',  Icon: Home      },
  { label: 'Expenses',   path: '/expenses',   Icon: Receipt   },
  { label: 'Complaints', path: '/complaints', Icon: Wrench    },
  { label: 'Profile',    path: '/profile',    Icon: User      },
]

const MANAGER_TABS_HOSTEL = [
  { label: 'Dashboard',  path: '/manager',             Icon: LayoutDashboard },
  { label: 'Scan',       path: '/scan',                Icon: ScanLine        },
  { label: 'Complaints', path: '/manager/complaints',  Icon: Wrench          },
  { label: 'Payments',   path: '/manager/payments',    Icon: Receipt         },
  { label: 'Profile',    path: '/profile',             Icon: User            },
]

// PG manager: no Scan tab — no gate-pass infrastructure to scan.
const MANAGER_TABS_PG = [
  { label: 'Dashboard',  path: '/manager',             Icon: LayoutDashboard },
  { label: 'Complaints', path: '/manager/complaints',  Icon: Wrench          },
  { label: 'Payments',   path: '/manager/payments',    Icon: Receipt         },
  { label: 'Profile',    path: '/profile',             Icon: User            },
]

export function BottomNav() {
  const user      = useAuthStore((s) => s.user)
  const propType  = user?.hostel?.property_type
  const isManager = user?.profile.role === 'warden' || user?.profile.role === 'manager'

  const tabs = isManager
    ? (propType === 'pg' ? MANAGER_TABS_PG : MANAGER_TABS_HOSTEL)
    : propType === 'shared'
    ? SHARED_TABS
    : propType === 'pg'
    ? PG_TABS
    : HOSTEL_TABS

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border max-w-[480px] mx-auto md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map(({ label, path, Icon }) => (
          <NavLink
            key={`${label}-${path}`}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors',
                isActive ? 'text-primary' : 'text-text-tertiary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={cn('text-[10px] leading-none', isActive ? 'font-semibold' : 'font-normal')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
