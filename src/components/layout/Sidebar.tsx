import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, QrCode, UtensilsCrossed, Wrench,
  CreditCard, Siren, User, BedDouble, Settings, LogOut, Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { getInitials, getAvatarColor } from '@/lib/utils'

const HOSTEL_NAV = [
  { label: 'Dashboard',   path: '/dashboard',  Icon: LayoutDashboard },
  { label: 'Gate Pass',   path: '/gate-pass',  Icon: QrCode          },
  { label: 'Mess',        path: '/mess',       Icon: UtensilsCrossed },
  { label: 'Complaints',  path: '/complaints', Icon: Wrench          },
  { label: 'Payments',    path: '/payments',   Icon: CreditCard      },
  { label: 'Emergency',   path: '/emergency',  Icon: Siren           },
  { label: 'Profile',     path: '/profile',    Icon: User            },
]

const SHARED_NAV = [
  { label: 'Dashboard',   path: '/dashboard',  Icon: LayoutDashboard },
  { label: 'Expenses',    path: '/expenses',   Icon: Receipt         },
  { label: 'Complaints',  path: '/complaints', Icon: Wrench          },
  { label: 'Payments',    path: '/payments',   Icon: CreditCard      },
  { label: 'Emergency',   path: '/emergency',  Icon: Siren           },
  { label: 'Profile',     path: '/profile',    Icon: User            },
]

const MANAGER_NAV = [
  { label: 'Dashboard',   path: '/manager',    Icon: LayoutDashboard },
  { label: 'Gate',        path: '/gate-pass',  Icon: QrCode          },
  { label: 'Complaints',  path: '/complaints', Icon: Wrench          },
  { label: 'Payments',    path: '/payments',   Icon: CreditCard      },
  { label: 'Rooms',       path: '/profile',    Icon: BedDouble       },
  { label: 'Settings',    path: '/profile',    Icon: Settings        },
]

export function Sidebar() {
  const user      = useAuthStore((s) => s.user)
  const clear     = useAuthStore((s) => s.clear)
  const navigate  = useNavigate()
  const isManager = user?.profile.role === 'warden' || user?.profile.role === 'manager'
  const propType  = (user?.hostel as unknown as { property_type?: string })?.property_type
  const nav       = isManager ? MANAGER_NAV : propType === 'shared' ? SHARED_NAV : HOSTEL_NAV

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'

  async function handleSignOut() {
    await supabase.auth.signOut()
    clear()
    navigate('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-dvh bg-surface border-r border-border fixed left-0 top-0 z-50">

      {/* Brand */}
      <div className="px-5 py-6 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 bg-primary rounded-inner flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-[16px]">A</span>
        </div>
        <div>
          <p className="text-[16px] font-black text-primary">Ashiyaan</p>
          <p className="text-[11px] text-text-tertiary">{user?.hostel?.name ?? 'Hostel'}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, path, Icon }) => (
          <NavLink
            key={`${label}-${path}`}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-inner text-[14px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-inner mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-text-primary truncate">{user?.profile.full_name}</p>
            <p className="text-[11px] text-text-tertiary capitalize truncate">{user?.profile.role}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-inner text-[14px] font-medium text-danger hover:bg-danger-light transition-colors w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
