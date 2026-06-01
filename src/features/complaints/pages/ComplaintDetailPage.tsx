import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, AlertCircle, Star, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useComplaintDetail } from '../hooks/useComplaints'
import { rateComplaint, deleteComplaint } from '@/services/complaints.service'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { formatDate, formatTime } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type ComplaintStatus = Database['public']['Enums']['complaint_status']

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; Icon: React.ElementType; color: string }> = {
  submitted:   { label: 'Submitted',   Icon: AlertCircle,  color: 'text-info'    },
  in_progress: { label: 'In Progress', Icon: Clock,        color: 'text-warning' },
  resolved:    { label: 'Resolved',    Icon: CheckCircle2, color: 'text-success' },
  closed:      { label: 'Closed',      Icon: CheckCircle2, color: 'text-text-tertiary' },
  rejected:    { label: 'Rejected',    Icon: AlertCircle,  color: 'text-danger'  },
}

export default function ComplaintDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc      = useQueryClient()
  const user    = useAuthStore((s) => s.user)
  const { data: complaint, isLoading } = useComplaintDetail(id ?? '')
  const [hoverRating,    setHoverRating]    = useState(0)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  const { mutate: submitRating, isPending: rating } = useMutation({
    mutationFn: (r: number) => rateComplaint(id!, r),
    onSuccess: () => {
      toast.success('Thanks for your feedback!')
      qc.invalidateQueries({ queryKey: ['complaint', id] })
    },
  })

  const { mutate: removComplaint, isPending: deleting } = useMutation({
    mutationFn: () => deleteComplaint(id!, user!.id),
    onSuccess: () => {
      toast.success('Complaint deleted')
      qc.invalidateQueries({ queryKey: ['complaints', user?.id] })
      navigate('/complaints', { replace: true })
    },
    onError: () => toast.error('Failed to delete complaint'),
  })

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas pb-24">
        <TopBar title="Complaint" showBack />
        <div className="px-4 pt-16 space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="min-h-dvh bg-canvas pb-24">
        <TopBar title="Complaint" showBack />
        <div className="px-4 pt-16">
          <p className="text-text-secondary text-center">Complaint not found.</p>
        </div>
      </div>
    )
  }

  const statusConf = STATUS_CONFIG[complaint.status] ?? STATUS_CONFIG.submitted
  const updates    = (complaint as unknown as { complaint_updates: Array<{
    id: string; new_status: ComplaintStatus; note: string | null; created_at: string
  }> }).complaint_updates ?? []

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title={`#${complaint.id.slice(-6).toUpperCase()}`} showBack />

      <div className="px-4 pt-16 space-y-5">

        {/* ── Header ── */}
        <div className="bg-surface rounded-card shadow-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[18px] font-bold text-text-primary leading-snug flex-1">{complaint.title}</p>
            <Badge variant={complaint.status}>{statusConf.label}</Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={complaint.priority}>{complaint.priority}</Badge>
            <Badge variant={complaint.category as 'general'}>{complaint.category}</Badge>
          </div>
          <p className="text-[12px] text-text-tertiary">
            Submitted {formatDate(complaint.created_at, { day: '2-digit', month: 'short' })}, {formatTime(complaint.created_at)}
          </p>
        </div>

        {/* ── Description ── */}
        <div className="bg-surface rounded-card shadow-card p-4">
          <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">Description</p>
          <p className="text-[14px] text-text-primary leading-relaxed">{complaint.description}</p>
        </div>

        {/* ── Photos ── */}
        {complaint.photos?.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">Photos</p>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none">
              {complaint.photos.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-24 h-24 rounded-card object-cover flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Status Timeline ── */}
        <div>
          <p className="text-[17px] font-bold text-text-primary mb-4">Status Updates</p>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-4">
              {/* Initial submission */}
              <TimelineItem
                status="submitted"
                label="Complaint Submitted"
                date={complaint.created_at}
                note={null}
                isFirst
              />

              {updates.map((u) => (
                <TimelineItem
                  key={u.id}
                  status={u.new_status}
                  label={STATUS_CONFIG[u.new_status]?.label ?? u.new_status}
                  date={u.created_at}
                  note={u.note}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Resolution note ── */}
        {complaint.resolution_note && (
          <div className="bg-success-light rounded-card p-4">
            <p className="text-[12px] font-semibold text-success mb-1">Resolution Note</p>
            <p className="text-[14px] text-text-primary">{complaint.resolution_note}</p>
          </div>
        )}

        {/* ── Delete — only for own submitted complaints ── */}
        {complaint.user_id === user?.id && complaint.status === 'submitted' && (
          <div className="bg-surface rounded-card shadow-card p-4">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-danger text-[14px] font-semibold w-full justify-center py-1 hover:opacity-80 transition-opacity"
              >
                <Trash2 size={16} />
                Delete Complaint
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-[14px] font-semibold text-text-primary text-center">
                  Delete this complaint?
                </p>
                <p className="text-[13px] text-text-secondary text-center">
                  This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep it
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    loading={deleting}
                    onClick={() => removComplaint()}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Rating ── */}
        {complaint.status === 'resolved' && (
          <div className="bg-surface rounded-card shadow-card p-4">
            <p className="text-[15px] font-bold text-text-primary mb-1">Rate the resolution</p>
            <p className="text-[13px] text-text-secondary mb-3">How satisfied are you with how this was handled?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  disabled={!!complaint.rating || rating}
                  onClick={() => submitRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform active:scale-110"
                >
                  <Star
                    size={28}
                    className={
                      star <= (hoverRating || complaint.rating || 0)
                        ? 'fill-accent text-accent'
                        : 'text-border'
                    }
                  />
                </button>
              ))}
            </div>
            {complaint.rating && (
              <p className="text-[12px] text-text-tertiary mt-2">You rated this {complaint.rating}/5</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function TimelineItem({
  status, label, date, note, isFirst = false,
}: {
  status: ComplaintStatus
  label: string
  date: string
  note: string | null
  isFirst?: boolean
}) {
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted
  const Icon = conf.Icon

  return (
    <div className="flex gap-4 relative pl-8">
      {/* Dot */}
      <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-surface bg-surface ${
        isFirst ? 'bg-primary border-primary' : 'bg-surface border-border'
      }`}>
        <Icon size={14} className={isFirst ? 'text-white' : conf.color} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-[14px] font-semibold ${isFirst ? 'text-primary' : 'text-text-primary'}`}>{label}</p>
          <p className="text-[11px] text-text-tertiary flex-shrink-0">
            {formatDate(date, { day: '2-digit', month: 'short' })} {formatTime(date)}
          </p>
        </div>
        {note && (
          <div className="mt-1.5 bg-surface-raised rounded-inner px-3 py-2">
            <p className="text-[13px] text-text-secondary">{note}</p>
          </div>
        )}
      </div>
    </div>
  )
}
