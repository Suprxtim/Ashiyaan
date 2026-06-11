import { useNavigate } from 'react-router-dom'
import {
  Plus, Calendar, MapPin, Clock, CheckCircle2, XCircle, Ban,
} from 'lucide-react'
import { useLeaveRequests } from '../hooks/useLeaveRequests'
import { TopBar } from '@/components/layout/TopBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
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

export default function LeaveRequestsPage() {
  const navigate = useNavigate()
  const { requests, isLoading, filterStatus, setFilterStatus, cancel, cancelling } = useLeaveRequests()

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopBar title="Outpass / Leave" />

      <div className="pt-14 space-y-4">

        {/* ── Filter chips ── */}
        <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1 scrollbar-none">
          {FILTERS.map(({ label, value }) => {
            const active = filterStatus === value
            return (
              <button
                key={label}
                onClick={() => setFilterStatus(value)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-pill text-[13px] font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-secondary border border-border'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

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
            <EmptyState
              icon={<Calendar size={28} />}
              title={filterStatus ? 'Nothing here' : 'No leave requests yet'}
              description={
                filterStatus
                  ? `No ${FILTERS.find((f) => f.value === filterStatus)?.label.toLowerCase()} requests`
                  : 'Apply for an outpass or overnight leave'
              }
              action={
                filterStatus
                  ? undefined
                  : { label: 'Apply for Leave', onClick: () => navigate('/leave/new') }
              }
            />
          ) : (
            requests.map((r) => {
              const status = STATUS_CONFIG[r.status]
              const StatusIcon = status.Icon

              return (
                <div key={r.id} className="bg-surface rounded-card shadow-card p-4">
                  <div className="flex items-start gap-3 mb-2">
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
                      {r.destination && (
                        <p className="text-[12px] text-text-tertiary mt-0.5 flex items-center gap-1">
                          <MapPin size={11} /> {r.destination}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[13px] text-text-secondary leading-relaxed mb-2">
                    {r.reason}
                  </p>

                  {r.review_note && (
                    <p className="text-[12px] text-text-tertiary bg-surface-raised rounded-inner px-3 py-2 mb-2">
                      <span className="font-semibold">Note: </span>{r.review_note}
                    </p>
                  )}

                  {r.status === 'pending' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={cancelling}
                      onClick={() => cancel(r.id)}
                    >
                      Cancel Request
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => navigate('/leave/new')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-raised active:scale-95 transition-transform z-40"
        aria-label="New leave request"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  )
}
