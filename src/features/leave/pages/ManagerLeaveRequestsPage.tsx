import { useState } from 'react'
import {
  Calendar, MapPin, Clock, CheckCircle2, XCircle, Ban,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getAllHostelLeaveRequests, updateLeaveRequestStatus } from '@/services/leaveRequest.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { formatDate, timeAgo } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type LeaveStatus = Database['public']['Enums']['leave_status']

const FILTERS: { label: string; value: LeaveStatus | undefined }[] = [
  { label: 'All',       value: undefined  },
  { label: 'Pending',   value: 'pending'  },
  { label: 'Approved',  value: 'approved' },
  { label: 'Rejected',  value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
]

const STATUS_CONFIG: Record<LeaveStatus, { label: string; className: string; Icon: React.ElementType }> = {
  pending:   { label: 'Pending',   className: 'bg-warning-light text-warning',       Icon: Clock        },
  approved:  { label: 'Approved',  className: 'bg-success-light text-success',       Icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  className: 'bg-danger-light text-danger',         Icon: XCircle      },
  cancelled: { label: 'Cancelled', className: 'bg-surface-raised text-text-tertiary', Icon: Ban          },
}

export default function ManagerLeaveRequestsPage() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''
  const userId   = user?.id ?? ''

  const [filterStatus, setFilterStatus] = useState<LeaveStatus | undefined>('pending')
  const [rejectingId,  setRejectingId]  = useState<string | null>(null)
  const [rejectNote,   setRejectNote]   = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['manager-leave-requests', hostelId, filterStatus],
    queryFn:  () => getAllHostelLeaveRequests(hostelId, filterStatus),
    enabled:  !!hostelId,
  })

  const { mutate: review, isPending: reviewing } = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'approved' | 'rejected'; note?: string }) =>
      updateLeaveRequestStatus(id, status, userId, note),
    onSuccess: (_data, { status }) => {
      toast.success(status === 'approved' ? 'Leave approved' : 'Leave rejected')
      setRejectingId(null)
      setRejectNote('')
      qc.invalidateQueries({ queryKey: ['manager-leave-requests', hostelId] })
    },
    onError: () => toast.error('Failed to update request'),
  })

  function handleFilterChange(value: LeaveStatus | undefined) {
    setFilterStatus(value)
    setRejectingId(null)
    setRejectNote('')
  }

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopBar title="Leave Requests" showBack={false} />

      <div className="pt-14 space-y-4">

        {/* ── Filter chips ── */}
        <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1 scrollbar-none">
          {FILTERS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => handleFilterChange(value)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-pill text-[13px] font-semibold transition-colors ${
                filterStatus === value
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary border border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Result count ── */}
        {!isLoading && (
          <p className="px-4 text-[12px] text-text-tertiary">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* ── List ── */}
        <div className="px-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-card shadow-card p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                  <div className="flex-1"><Skeleton lines={2} /></div>
                </div>
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))
          ) : requests.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card p-8 text-center space-y-2">
              <CheckCircle2 size={32} className="text-success mx-auto" />
              <p className="text-[16px] font-bold text-text-primary">All caught up!</p>
              <p className="text-[13px] text-text-secondary">
                {filterStatus
                  ? `No ${FILTERS.find((f) => f.value === filterStatus)?.label.toLowerCase()} requests`
                  : 'No leave requests yet'}
              </p>
            </div>
          ) : (
            requests.map((r) => {
              const profile  = r.profiles
              const status   = STATUS_CONFIG[r.status]
              const StatusIcon = status.Icon
              const isRejecting = rejectingId === r.id

              return (
                <div key={r.id} className="bg-surface rounded-card shadow-card overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-2.5">
                      <div className="w-10 h-10 rounded-inner flex items-center justify-center flex-shrink-0 bg-primary-light text-primary">
                        <Calendar size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[15px] font-bold text-text-primary leading-snug">
                            {formatDate(r.from_date)} – {formatDate(r.to_date)}
                          </p>
                          <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-pill ${status.className}`}>
                            <StatusIcon size={11} />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-tertiary mt-0.5">
                          {profile?.full_name ?? 'Unknown'} · Room {profile?.room_number ?? '—'} · {timeAgo(r.created_at)}
                        </p>
                      </div>
                    </div>

                    <p className="text-[13px] text-text-secondary leading-relaxed mb-2">
                      {r.reason}
                    </p>

                    {r.destination && (
                      <p className="text-[12px] text-text-tertiary flex items-center gap-1 mb-2">
                        <MapPin size={11} /> {r.destination}
                      </p>
                    )}

                    {r.review_note && (
                      <p className="text-[12px] text-text-tertiary bg-surface-raised rounded-inner px-3 py-2">
                        <span className="font-semibold">Note: </span>{r.review_note}
                      </p>
                    )}
                  </div>

                  {/* ── Action bar ── */}
                  {r.status === 'pending' && (
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {!isRejecting ? (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => { setRejectingId(r.id); setRejectNote('') }}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="dark"
                            fullWidth
                            loading={reviewing && rejectingId === null}
                            onClick={() => review({ id: r.id, status: 'approved' })}
                          >
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <>
                          <textarea
                            autoFocus
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value.slice(0, 300))}
                            placeholder="Reason for rejection (optional)…"
                            rows={3}
                            className="w-full bg-surface-raised border border-border rounded-card px-3 py-2.5 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              fullWidth
                              onClick={() => { setRejectingId(null); setRejectNote('') }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="danger"
                              fullWidth
                              loading={reviewing}
                              onClick={() => review({ id: r.id, status: 'rejected', note: rejectNote })}
                            >
                              Confirm Reject
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
