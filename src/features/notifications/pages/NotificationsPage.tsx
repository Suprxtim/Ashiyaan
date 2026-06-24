import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Wrench, IndianRupee, Siren,
  Megaphone, CheckCheck, AlertTriangle, Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { getTripsCurrentlyOut, markTripReturnedByManager, isOverdueTrip } from '@/services/gateTrip.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo, getInitials, getAvatarColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

const NOTIF_ICON: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  complaint_update: { Icon: Wrench,       bg: 'bg-warning-light', color: 'text-warning' },
  new_complaint:    { Icon: Wrench,       bg: 'bg-danger-light',  color: 'text-danger'  },
  payment_due:      { Icon: IndianRupee,  bg: 'bg-info-light',    color: 'text-info'    },
  sos_alert:        { Icon: Siren,        bg: 'bg-danger-light',  color: 'text-danger'  },
  announcement:     { Icon: Megaphone,    bg: 'bg-primary-light', color: 'text-primary' },
  default:          { Icon: Bell,         bg: 'bg-surface-raised', color: 'text-text-secondary' },
}

const NOTIF_ROUTE: Record<string, (data: Record<string, string>) => string> = {
  complaint_update: (d) => `/complaints/${d.complaint_id}`,
  new_complaint:    (d) => `/complaints/${d.complaint_id}`,
  payment_due:      ()  => '/payments',
  sos_alert:        ()  => '/emergency',   // overridden for managers below
  announcement:     ()  => '/community',
}

async function fetchNotifications(userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

async function markOneRead(id: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

async function markAllRead(userId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
}

function formatOverdue(expectedAt: string | null): string {
  if (!expectedAt) return 'Past due'
  const mins = Math.floor((Date.now() - new Date(expectedAt).getTime()) / 60000)
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''}`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

export default function NotificationsPage() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const user      = useAuthStore((s) => s.user)
  const userId    = user?.id ?? ''
  const hostelId  = user?.profile.hostel_id ?? ''
  const isManager = user?.profile.role === 'warden' || user?.profile.role === 'manager'
  const isPg      = user?.hostel?.property_type === 'pg'

  const { data: overdueTrips = [] } = useQuery({
    queryKey: ['trips-currently-out', hostelId],
    queryFn:  () => getTripsCurrentlyOut(hostelId),
    enabled:  !!hostelId && isManager && !isPg,
    refetchInterval: 30_000,
    select: (trips) => trips.filter(isOverdueTrip),
  })

  const { mutate: markReturned } = useMutation({
    mutationFn: (tripId: string) => markTripReturnedByManager(tripId),
    onSuccess: () => {
      toast.success('Marked as returned')
      qc.invalidateQueries({ queryKey: ['trips-currently-out', hostelId] })
    },
    onError: () => toast.error('Failed to update'),
  })

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn:  () => fetchNotifications(userId),
    enabled:  !!userId,
  })

  const { mutate: markAll } = useMutation({
    mutationFn: () => markAllRead(userId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  })

  // Realtime subscription
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications', userId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, qc])

  async function handleNotifClick(notif: typeof notifications[number]) {
    if (!notif.is_read) {
      await markOneRead(notif.id)
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    }

    // SOS alerts route to the incident management page for managers
    if (notif.type === 'sos_alert') {
      const isManager = user?.profile.role === 'warden' || user?.profile.role === 'manager'
      navigate(isManager ? '/manager/sos' : '/emergency')
      return
    }

    const routeFn = NOTIF_ROUTE[notif.type]
    if (routeFn) {
      const data = (notif.data ?? {}) as Record<string, string>
      navigate(routeFn(data))
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar
        title="Notifications"
        showBack
        rightSlot={
          unreadCount > 0 ? (
            <button
              onClick={() => markAll()}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="pt-14 px-4 space-y-3">

        {/* ── Overdue Students (managers only) ── */}
        {isManager && !isPg && overdueTrips.length > 0 && (
          <div className="bg-danger-light border border-danger/20 rounded-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-danger flex-shrink-0" />
              <p className="text-[13px] font-bold text-danger">
                {overdueTrips.length} student{overdueTrips.length !== 1 ? 's' : ''} haven't returned
              </p>
            </div>
            {overdueTrips.map((trip) => {
              const name        = trip.profiles?.full_name ?? 'Unknown'
              const phone       = trip.profiles?.phone
              const parentPhone = trip.profiles?.parent_phone
              const callNumber  = phone ?? parentPhone
              const room        = trip.profiles?.room_number
              return (
                <div key={trip.id} className="flex items-center gap-3 bg-surface rounded-inner px-3 py-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                    style={{ backgroundColor: getAvatarColor(name) }}
                  >
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-text-primary truncate">{name}</p>
                    <p className="text-[11px] text-danger font-medium">
                      {formatOverdue(trip.expected_return_at)} overdue
                      {room ? ` · Room ${room}` : ''}
                    </p>
                    {!phone && parentPhone && (
                      <p className="text-[10px] text-text-tertiary mt-0.5">Calling parent</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {callNumber ? (
                      <a
                        href={`tel:${callNumber}`}
                        className="flex items-center gap-1 bg-primary text-white text-[12px] font-semibold px-2.5 py-1.5 rounded-btn active:scale-95 transition-transform"
                      >
                        <Phone size={12} /> Call
                      </a>
                    ) : (
                      <span className="text-[11px] text-text-tertiary">No number</span>
                    )}
                    <button
                      onClick={() => markReturned(trip.id)}
                      className="text-[12px] font-semibold text-text-secondary border border-border rounded-btn px-2.5 py-1.5 active:scale-95 transition-transform"
                    >
                      Returned
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {unreadCount > 0 && (
          <p className="text-[12px] font-semibold text-text-tertiary">
            {unreadCount} unread
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="bg-surface rounded-card shadow-card p-4 flex gap-3">
                <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                <div className="flex-1"><Skeleton lines={2} /></div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} />}
            title="No notifications"
            description="You're all caught up! Notifications about your complaints, payments, and announcements will appear here."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const conf = NOTIF_ICON[notif.type] ?? NOTIF_ICON.default
              const Icon = conf.Icon
              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={cn(
                    'w-full text-left bg-surface rounded-card shadow-card px-4 py-3.5 flex items-start gap-3 active:scale-[0.99] transition-transform',
                    !notif.is_read && 'border-l-4 border-l-primary bg-primary-light/20'
                  )}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${conf.bg}`}>
                    <Icon size={18} className={conf.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-[14px] leading-snug', notif.is_read ? 'font-medium text-text-primary' : 'font-bold text-text-primary')}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {notif.body && (
                      <p className="text-[13px] text-text-secondary mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-[11px] text-text-tertiary mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
