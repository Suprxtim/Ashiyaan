import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Droplets, Wifi, Sparkles, Armchair, MoreHorizontal,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Flame, Search,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getAllHostelComplaints, updateComplaintWithNote } from '@/services/manager.service'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { timeAgo } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type ComplaintStatus  = Database['public']['Enums']['complaint_status']
type ComplaintPriority = Database['public']['Enums']['complaint_priority']

const FILTERS: { label: string; value: ComplaintStatus | undefined }[] = [
  { label: 'All',         value: undefined      },
  { label: 'Open',        value: 'submitted'    },
  { label: 'In Progress', value: 'in_progress'  },
  { label: 'Resolved',    value: 'resolved'     },
  { label: 'Closed',      value: 'closed'       },
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

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; className: string }> = {
  submitted:   { label: 'Open',        className: 'bg-info-light text-info'              },
  in_progress: { label: 'In Progress', className: 'bg-warning-light text-warning'         },
  resolved:    { label: 'Resolved',    className: 'bg-success-light text-success'         },
  closed:      { label: 'Closed',      className: 'bg-surface-raised text-text-tertiary'  },
  rejected:    { label: 'Rejected',    className: 'bg-danger-light text-danger'            },
}

const PRIORITY_CONFIG: Record<ComplaintPriority, string> = {
  urgent: 'bg-danger-light text-danger',
  high:   'bg-warning-light text-warning',
  medium: 'bg-surface-raised text-text-secondary',
  low:    'bg-surface-raised text-text-tertiary',
}

const PRIORITY_ICON: Record<ComplaintPriority, React.ElementType> = {
  urgent: Flame,
  high:   AlertCircle,
  medium: Clock,
  low:    CheckCircle2,
}

export default function ManagerComplaintsPage() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const user      = useAuthStore((s) => s.user)
  const hostelId  = user?.profile.hostel_id ?? ''
  const userId    = user?.id ?? ''

  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | undefined>(undefined)
  const [search,       setSearch]       = useState('')
  const [resolvingId,  setResolvingId]  = useState<string | null>(null)
  const [resolveNote,  setResolveNote]  = useState('')

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['manager-complaints', hostelId, filterStatus],
    queryFn:  () => getAllHostelComplaints(hostelId, filterStatus),
    enabled:  !!hostelId,
  })

  const filteredComplaints = complaints.filter((c) => {
    if (!search) return true
    const profile = c.profiles
    const q = search.toLowerCase()
    return (
      c.title.toLowerCase().includes(q) ||
      profile?.full_name?.toLowerCase().includes(q) ||
      profile?.room_number?.toLowerCase().includes(q)
    )
  })

  const { mutate: updateStatus, isPending: updating } = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: ComplaintStatus; note: string }) =>
      updateComplaintWithNote(id, status, note, userId),
    onSuccess: (_data, { status }) => {
      toast.success(status === 'in_progress' ? 'Marked as in progress' : 'Complaint resolved')
      setResolvingId(null)
      setResolveNote('')
      qc.invalidateQueries({ queryKey: ['manager-complaints', hostelId] })
      qc.invalidateQueries({ queryKey: ['open-complaints',    hostelId] })
      qc.invalidateQueries({ queryKey: ['manager-stats',      hostelId] })
    },
    onError: () => toast.error('Failed to update complaint'),
  })

  function handleFilterChange(value: ComplaintStatus | undefined) {
    setFilterStatus(value)
    setResolvingId(null)
    setResolveNote('')
  }

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopBar title="Complaints" showBack={false} />

      <div className="pt-14 space-y-4">

        {/* ── Search ── */}
        <div className="relative px-4">
          <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by name, room or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 bg-surface border border-border rounded-input pl-9 pr-4 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>

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
            {filteredComplaints.length} complaint{filteredComplaints.length !== 1 ? 's' : ''}
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
          ) : filteredComplaints.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card p-8 text-center space-y-2">
              <CheckCircle2 size={32} className="text-success mx-auto" />
              <p className="text-[16px] font-bold text-text-primary">
                {search ? 'No matches found' : 'All caught up!'}
              </p>
              <p className="text-[13px] text-text-secondary">
                {search
                  ? 'Try a different name, room or title'
                  : filterStatus
                  ? `No ${FILTERS.find((f) => f.value === filterStatus)?.label.toLowerCase()} complaints`
                  : 'No complaints submitted yet'}
              </p>
            </div>
          ) : (
            filteredComplaints.map((c) => {
              const profile   = c.profiles
              const status    = STATUS_CONFIG[c.status]    ?? STATUS_CONFIG.submitted
              const catColor  = CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS.other
              const catIcon   = CATEGORY_ICONS[c.category]  ?? CATEGORY_ICONS.other
              const priClass  = PRIORITY_CONFIG[c.priority]  ?? PRIORITY_CONFIG.medium
              const PriIcon   = PRIORITY_ICON[c.priority]   ?? Clock
              const isResolving = resolvingId === c.id
              const canAct    = c.status === 'submitted' || c.status === 'in_progress'

              return (
                <div key={c.id} className="bg-surface rounded-card shadow-card overflow-hidden">

                  {/* ── Card body — tap to view detail ── */}
                  <button
                    onClick={() => navigate(`/complaints/${c.id}`)}
                    className="w-full text-left p-4 active:bg-surface-raised transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-2.5">
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
                          {profile?.full_name ?? 'Unknown'} · Room {profile?.room_number ?? '—'} · {timeAgo(c.created_at)}
                        </p>
                      </div>
                    </div>

                    <p className="text-[13px] text-text-secondary line-clamp-2 leading-relaxed mb-2.5">
                      {c.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-pill capitalize ${priClass}`}>
                        <PriIcon size={10} />
                        {c.priority}
                      </span>
                      <ChevronRight size={14} className="text-text-tertiary" />
                    </div>
                  </button>

                  {/* ── Action bar ── */}
                  {canAct && (
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {/* Start Working — only for submitted, not in resolve mode */}
                      {c.status === 'submitted' && !isResolving && (
                        <Button
                          variant="secondary"
                          fullWidth
                          loading={updating && resolvingId === null}
                          onClick={() => updateStatus({ id: c.id, status: 'in_progress', note: 'Work started' })}
                        >
                          Start Working
                        </Button>
                      )}

                      {/* Mark Resolved button — only for in_progress */}
                      {c.status === 'in_progress' && !isResolving && (
                        <Button
                          variant="dark"
                          fullWidth
                          onClick={() => { setResolvingId(c.id); setResolveNote('') }}
                        >
                          Mark Resolved
                        </Button>
                      )}

                      {/* Inline resolve note + confirm */}
                      {isResolving && (
                        <>
                          <textarea
                            autoFocus
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value.slice(0, 300))}
                            placeholder="Add a resolution note for the resident (optional)…"
                            rows={3}
                            className="w-full bg-surface-raised border border-border rounded-card px-3 py-2.5 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              fullWidth
                              onClick={() => { setResolvingId(null); setResolveNote('') }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="dark"
                              fullWidth
                              loading={updating}
                              onClick={() => updateStatus({ id: c.id, status: 'resolved', note: resolveNote })}
                            >
                              Confirm Resolved
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
