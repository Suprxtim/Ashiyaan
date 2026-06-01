import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface TopBarProps {
  title?: string
  showBack?: boolean
  dark?: boolean
  rightSlot?: React.ReactNode
  className?: string
}

function useUnreadCount(userId: string) {
  const { data } = useQuery({
    queryKey: ['unread-count', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      return count ?? 0
    },
    enabled:        !!userId,
    refetchInterval: 30_000,
  })
  return data ?? 0
}

export function TopBar({ title, showBack, dark = false, rightSlot, className }: TopBarProps) {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const unread      = useUnreadCount(user?.id ?? '')

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 gap-3 md:left-60',
        dark ? 'bg-primary text-white' : 'bg-surface border-b border-border text-text-primary',
        className
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className={cn('p-1.5 rounded-inner transition-colors', dark ? 'hover:bg-white/10' : 'hover:bg-surface-raised')}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {title ? (
          <span className="font-semibold text-[17px] truncate">{title}</span>
        ) : (
          <div className="min-w-0">
            <p className={cn('font-bold text-[15px] leading-tight truncate', dark ? 'text-white' : 'text-text-primary')}>
              {user?.hostel?.name ?? 'Ashiyaan'}
            </p>
            {user?.profile.room_number && (
              <p className={cn('text-[12px] leading-tight', dark ? 'text-white/70' : 'text-text-tertiary')}>
                Room {user.profile.room_number}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {rightSlot ?? (
          <>
            <button
              onClick={() => navigate('/notifications')}
              className={cn('relative p-1.5 rounded-inner transition-colors', dark ? 'hover:bg-white/10' : 'hover:bg-surface-raised')}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0 cursor-pointer"
              style={{ backgroundColor: avatarColor }}
              onClick={() => navigate('/profile')}
            >
              {initials}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
