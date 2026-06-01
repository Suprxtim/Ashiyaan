import { useNavigate } from 'react-router-dom'
import {
  Zap, Droplets, Wifi, Sparkles, Armchair, MoreHorizontal,
  ChevronRight, Plus, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react'
import { useComplaints } from '../hooks/useComplaints'
import { TopBar } from '@/components/layout/TopBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { timeAgo } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type ComplaintStatus = Database['public']['Enums']['complaint_status']

const FILTERS: { label: string; value: ComplaintStatus | undefined }[] = [
  { label: 'All',         value: undefined },
  { label: 'Open',        value: 'submitted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved',    value: 'resolved' },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  electrical: <Zap      size={18} />,
  plumbing:   <Droplets size={18} />,
  wifi:       <Wifi     size={18} />,
  cleaning:   <Sparkles size={18} />,
  furniture:  <Armchair size={18} />,
  other:      <MoreHorizontal size={18} />,
}

const CATEGORY_COLORS: Record<string, string> = {
  electrical: 'bg-warning-light text-warning',
  plumbing:   'bg-info-light text-info',
  wifi:       'bg-primary-light text-primary',
  cleaning:   'bg-success-light text-success',
  furniture:  'bg-accent-light text-warning',
  other:      'bg-surface-raised text-text-secondary',
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; className: string; Icon: React.ElementType }> = {
  submitted:   { label: 'Open',        className: 'bg-info-light text-info',        Icon: AlertCircle  },
  in_progress: { label: 'In Progress', className: 'bg-warning-light text-warning',  Icon: Clock        },
  resolved:    { label: 'Resolved',    className: 'bg-success-light text-success',  Icon: CheckCircle2 },
  closed:      { label: 'Closed',      className: 'bg-surface-raised text-text-tertiary', Icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    className: 'bg-danger-light text-danger',    Icon: AlertCircle  },
}

export default function ComplaintsPage() {
  const navigate = useNavigate()
  const { complaints, isLoading, filterStatus, setFilterStatus } = useComplaints()

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopBar title="Complaints" />

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
          ) : complaints.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={28} />}
              title={filterStatus ? 'Nothing here' : 'Everything looks good!'}
              description={
                filterStatus
                  ? `No ${FILTERS.find((f) => f.value === filterStatus)?.label.toLowerCase()} complaints`
                  : 'No complaints submitted yet'
              }
              action={
                filterStatus
                  ? undefined
                  : { label: 'Submit a Complaint', onClick: () => navigate('/complaints/new') }
              }
            />
          ) : (
            complaints.map((c) => {
              const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.submitted
              const catColor = CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS.other
              const catIcon  = CATEGORY_ICONS[c.category]  ?? CATEGORY_ICONS.other

              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/complaints/${c.id}`)}
                  className="w-full text-left bg-surface rounded-card shadow-card p-4 active:scale-[0.99] transition-transform"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-inner flex items-center justify-center flex-shrink-0 ${catColor}`}>
                      {catIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[15px] font-bold text-text-primary leading-snug">{c.title}</p>
                        <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-pill ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-tertiary mt-0.5">
                        Reported {timeAgo(c.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Description preview */}
                  <p className="text-[13px] text-text-secondary line-clamp-2 leading-relaxed mb-3">
                    {c.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {c.status === 'resolved' ? (
                        <>
                          <CheckCircle2 size={13} className="text-success" />
                          <span className="text-[12px] text-success font-medium">
                            {c.resolution_note ?? 'Issue resolved'}
                          </span>
                        </>
                      ) : c.status === 'in_progress' ? (
                        <>
                          <Clock size={13} className="text-warning" />
                          <span className="text-[12px] text-warning font-medium">In progress</span>
                        </>
                      ) : (
                        <span className="text-[12px] text-text-tertiary capitalize">{c.priority} priority</span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => navigate('/complaints/new')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-raised active:scale-95 transition-transform z-40"
        aria-label="New complaint"
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  )
}
