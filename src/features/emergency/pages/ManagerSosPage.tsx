import { useEffect } from 'react'
import { Siren, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { getSosIncidents, acknowledgeSosIncident } from '@/services/sos.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { getInitials, getAvatarColor, timeAgo, formatDate, formatTime } from '@/lib/utils'

export default function ManagerSosPage() {
  const qc        = useQueryClient()
  const user      = useAuthStore((s) => s.user)
  const hostelId  = user?.profile.hostel_id ?? ''
  const userId    = user?.id ?? ''

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['sos-incidents', hostelId],
    queryFn:  () => getSosIncidents(hostelId),
    enabled:  !!hostelId,
  })

  // Realtime — refresh list the moment a new incident is inserted
  useEffect(() => {
    if (!hostelId) return
    const channel = supabase
      .channel(`sos-page:${hostelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_incidents', filter: `hostel_id=eq.${hostelId}` },
        () => qc.invalidateQueries({ queryKey: ['sos-incidents', hostelId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [hostelId, qc])

  const { mutate: acknowledge, isPending: acking } = useMutation({
    mutationFn: (id: string) => acknowledgeSosIncident(id, userId),
    onSuccess: () => {
      toast.success('Incident acknowledged — resident notified')
      qc.invalidateQueries({ queryKey: ['sos-incidents', hostelId] })
    },
    onError: () => toast.error('Failed to acknowledge'),
  })

  const active = incidents.filter((i) => i.status === 'active')
  const past   = incidents.filter((i) => i.status !== 'active')

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="SOS Alerts" showBack />

      <div className="pt-14 px-4 space-y-5">

        {/* ── Active alert header ── */}
        {active.length > 0 && (
          <div className="bg-danger rounded-card p-4 flex items-center gap-3 animate-pulse">
            <Siren size={22} className="text-white flex-shrink-0" />
            <p className="text-white font-bold text-[15px]">
              {active.length} active SOS alert{active.length !== 1 ? 's' : ''} — respond immediately
            </p>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-surface rounded-card shadow-card p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton circle className="w-12 h-12 flex-shrink-0" />
                  <div className="flex-1"><Skeleton lines={2} /></div>
                </div>
                <Skeleton className="h-10 w-full rounded-btn" />
              </div>
            ))}
          </div>
        )}

        {/* ── Active incidents ── */}
        {!isLoading && active.length === 0 && past.length === 0 && (
          <div className="bg-surface rounded-card shadow-card p-8 text-center space-y-2">
            <CheckCircle2 size={32} className="text-success mx-auto" />
            <p className="text-[16px] font-bold text-text-primary">All clear</p>
            <p className="text-[13px] text-text-secondary">No SOS alerts for this hostel</p>
          </div>
        )}

        {active.map((incident) => {
          const profile = (incident as unknown as { profiles: { full_name: string; room_number: string | null; avatar_url: string | null } }).profiles
          const name    = profile?.full_name ?? 'Unknown resident'
          const room    = profile?.room_number
          const hasLocation = incident.location_lat !== null && incident.location_lng !== null
          const mapsUrl = hasLocation
            ? `https://www.google.com/maps?q=${incident.location_lat},${incident.location_lng}`
            : null

          return (
            <div key={incident.id} className="bg-surface border-2 border-danger rounded-card shadow-raised overflow-hidden">
              {/* Alert strip */}
              <div className="bg-danger px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Siren size={15} className="text-white" />
                  <span className="text-white text-[12px] font-bold uppercase tracking-wide">SOS Active</span>
                </div>
                <span className="text-white/80 text-[12px]">{timeAgo(incident.created_at)}</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Resident info */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-bold flex-shrink-0"
                    style={{ backgroundColor: getAvatarColor(name) }}
                  >
                    {getInitials(name)}
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-text-primary">{name}</p>
                    <p className="text-[13px] text-text-secondary">
                      {room ? `Room ${room}` : 'Room not assigned'} · Triggered {formatDate(incident.created_at, { day: '2-digit', month: 'short' })} at {formatTime(incident.created_at)}
                    </p>
                  </div>
                </div>

                {/* Location */}
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-danger-light rounded-inner px-3 py-2.5 text-danger text-[13px] font-semibold"
                  >
                    <MapPin size={15} />
                    View location on Google Maps
                  </a>
                ) : (
                  <div className="flex items-center gap-2 bg-surface-raised rounded-inner px-3 py-2.5 text-text-tertiary text-[13px]">
                    <MapPin size={15} />
                    Location not shared
                  </div>
                )}

                {/* Acknowledge */}
                <Button
                  variant="danger"
                  fullWidth
                  loading={acking}
                  onClick={() => acknowledge(incident.id)}
                >
                  Acknowledge — I'm Responding
                </Button>
              </div>
            </div>
          )
        })}

        {/* ── Past incidents ── */}
        {past.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wide mb-3">
              Recent History
            </p>
            <div className="bg-surface rounded-card shadow-card overflow-hidden">
              {past.map((incident, idx) => {
                const profile = (incident as unknown as { profiles: { full_name: string; room_number: string | null } }).profiles
                const name    = profile?.full_name ?? 'Unknown'
                const isResolved  = incident.status === 'resolved'
                return (
                  <div key={incident.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isResolved ? 'bg-success-light' : 'bg-warning-light'
                      }`}>
                        {isResolved
                          ? <CheckCircle2 size={18} className="text-success" />
                          : <AlertTriangle size={18} className="text-warning" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary">{name}</p>
                        <p className="text-[12px] text-text-tertiary">
                          {formatDate(incident.created_at, { day: '2-digit', month: 'short' })} at {formatTime(incident.created_at)}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-pill capitalize flex-shrink-0 ${
                        isResolved ? 'bg-success-light text-success' : 'bg-warning-light text-warning'
                      }`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── No past incidents note ── */}
        {!isLoading && active.length === 0 && past.length > 0 && (
          <div className="bg-success-light rounded-card p-4 flex items-center gap-3">
            <CheckCircle2 size={18} className="text-success flex-shrink-0" />
            <p className="text-[13px] text-success font-semibold">No active alerts right now</p>
          </div>
        )}

      </div>
    </div>
  )
}
