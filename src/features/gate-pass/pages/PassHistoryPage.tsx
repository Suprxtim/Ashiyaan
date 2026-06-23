import { MapPin, ArrowRight, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { getMyTrips } from '@/services/gateTrip.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatTime } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-warning-light text-warning',
  out:       'bg-primary-light text-primary',
  overdue:   'bg-danger-light text-danger',
  returned:  'bg-success-light text-success',
  cancelled: 'bg-surface-raised text-text-tertiary',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  out:       'Outside',
  overdue:   'Overdue',
  returned:  'Returned',
  cancelled: 'Cancelled',
}

function formatDuration(exitAt: string, returnAt: string): string {
  const mins = Math.round((new Date(returnAt).getTime() - new Date(exitAt).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function PassHistoryPage() {
  const user   = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['my-trips', userId],
    queryFn:  () => getMyTrips(userId, 50),
    enabled:  !!userId,
  })

  // Group by date (using exit_at date, or created_at if not yet out)
  const grouped = trips.reduce<Record<string, typeof trips>>((acc, trip) => {
    const d = trip.exit_at ?? trip.created_at
    const date = formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' })
    if (!acc[date]) acc[date] = []
    acc[date].push(trip)
    return acc
  }, {})

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Trip History" showBack />
      <div className="px-4 pt-16 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                <div className="flex-1"><Skeleton lines={2} /></div>
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <EmptyState
            icon={<MapPin size={28} />}
            title="No trips yet"
            description="Your gate pass trips will appear here"
          />
        ) : (
          Object.entries(grouped).map(([date, dayTrips]) => (
            <div key={date}>
              <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">
                {date}
              </p>
              <div className="space-y-2">
                {dayTrips.map((trip) => (
                  <div key={trip.id} className="bg-surface rounded-card px-4 py-3 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">{trip.destination}</p>
                        {trip.purpose && (
                          <p className="text-[12px] text-text-tertiary italic">{trip.purpose}</p>
                        )}
                        {/* Times row */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {trip.exit_at ? (
                            <>
                              <span className="text-[12px] text-text-tertiary">Out: {formatTime(trip.exit_at)}</span>
                              {trip.return_at ? (
                                <>
                                  <ArrowRight size={10} className="text-text-tertiary" />
                                  <span className="text-[12px] text-text-tertiary">In: {formatTime(trip.return_at)}</span>
                                  <span className="text-[11px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-pill">
                                    {formatDuration(trip.exit_at, trip.return_at)}
                                  </span>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[12px] text-text-tertiary">
                              Created: {formatTime(trip.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill flex-shrink-0 ${STATUS_COLOR[trip.status] ?? ''}`}>
                        {STATUS_LABEL[trip.status] ?? trip.status}
                      </span>
                    </div>
                    {trip.status === 'overdue' && (
                      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-danger">
                        <AlertCircle size={12} />
                        Expected by {formatTime(trip.expected_return_at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
