import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, AlertCircle, ArrowRight, Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getTripsCurrentlyOut, getTodaysTripLog } from '@/services/gateTrip.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { getInitials, getAvatarColor, formatTime, formatDate } from '@/lib/utils'
import type { GateTripWithProfile } from '@/services/gateTrip.service'

type Tab = 'outside' | 'log'

function formatDuration(exitAt: string, returnAt?: string | null): string {
  const end = returnAt ? new Date(returnAt) : new Date()
  const mins = Math.round((end.getTime() - new Date(exitAt).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function TripRow({ trip, showReturn }: { trip: GateTripWithProfile; showReturn: boolean }) {
  const profile   = trip.profiles
  const name      = profile?.full_name ?? 'Unknown'
  const room      = profile?.room_number
  const initials  = getInitials(name)
  const color     = getAvatarColor(name)
  const isOverdue = trip.status === 'overdue'

  return (
    <div className="bg-surface rounded-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-text-primary truncate">{name}</p>
            {room && (
              <span className="text-[11px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-pill flex-shrink-0">
                Rm {room}
              </span>
            )}
            {isOverdue && (
              <span className="text-[11px] font-bold text-danger bg-danger-light px-1.5 py-0.5 rounded-pill flex-shrink-0 flex items-center gap-1">
                <AlertCircle size={10} /> Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <MapPin size={11} className="text-text-tertiary flex-shrink-0" />
            <span className="text-[12px] text-text-tertiary truncate">{trip.destination}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {trip.exit_at && (
              <span className="text-[12px] text-text-tertiary">Out: {formatTime(trip.exit_at)}</span>
            )}
            {showReturn ? (
              trip.return_at ? (
                <>
                  <ArrowRight size={10} className="text-text-tertiary" />
                  <span className="text-[12px] text-text-tertiary">In: {formatTime(trip.return_at)}</span>
                  {trip.exit_at && (
                    <span className="text-[11px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-pill">
                      {formatDuration(trip.exit_at, trip.return_at)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[12px] text-text-tertiary italic">Still outside</span>
              )
            ) : (
              trip.expected_return_at && (
                <span className={`text-[12px] ${isOverdue ? 'text-danger font-semibold' : 'text-text-tertiary'}`}>
                  {isOverdue ? 'Was due: ' : 'Due: '}{formatTime(trip.expected_return_at)}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GateDashboardPage() {
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''
  const [tab, setTab] = useState<Tab>('outside')

  const { data: outside = [], isLoading: outsideLoading } = useQuery({
    queryKey: ['trips-currently-out', hostelId],
    queryFn:  () => getTripsCurrentlyOut(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 30_000,
  })

  const { data: log = [], isLoading: logLoading } = useQuery({
    queryKey: ['trips-today-log', hostelId],
    queryFn:  () => getTodaysTripLog(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 30_000,
  })

  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Gate Register" showBack />
      <div className="px-4 pt-16 space-y-4">

        {/* Tab bar */}
        <div className="flex bg-surface-raised rounded-inner p-1">
          <button
            onClick={() => setTab('outside')}
            className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${
              tab === 'outside' ? 'bg-surface text-primary shadow-card' : 'text-text-tertiary'
            }`}
          >
            Outside Now{outside.length > 0 ? ` (${outside.length})` : ''}
          </button>
          <button
            onClick={() => setTab('log')}
            className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${
              tab === 'log' ? 'bg-surface text-primary shadow-card' : 'text-text-tertiary'
            }`}
          >
            Today's Log
          </button>
        </div>

        {tab === 'outside' ? (
          <>
            <p className="text-[12px] text-text-tertiary px-1">
              {outside.length === 0
                ? 'All students are in'
                : `${outside.length} student${outside.length !== 1 ? 's' : ''} currently outside`}
            </p>
            {outsideLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : outside.length === 0 ? (
              <EmptyState
                icon={<Users size={28} />}
                title="All students are in"
                description="No students are currently signed out"
              />
            ) : (
              <div className="space-y-2">
                {outside.map((trip) => <TripRow key={trip.id} trip={trip} showReturn={false} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide px-1">{today}</p>
            {logLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : log.length === 0 ? (
              <EmptyState
                icon={<MapPin size={28} />}
                title="No movements today"
                description="Students who exit and return will appear here"
              />
            ) : (
              <div className="space-y-2">
                {log.map((trip) => <TripRow key={trip.id} trip={trip} showReturn={true} />)}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
