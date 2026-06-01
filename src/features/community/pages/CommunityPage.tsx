import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Pin, Plus, Trash2, Megaphone, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { fetchAnnouncements } from '@/services/dashboard.service'
import { createAnnouncement, deleteAnnouncement, togglePin } from '@/services/announcements.service'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type Category = Database['public']['Enums']['announcement_category']

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'general',     label: 'General',     color: 'bg-surface-raised text-text-secondary' },
  { value: 'event',       label: 'Event',       color: 'bg-primary-light text-primary'         },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-warning-light text-warning'         },
  { value: 'rule',        label: 'Rule',        color: 'bg-info-light text-info'               },
  { value: 'emergency',   label: 'Emergency',   color: 'bg-danger-light text-danger'           },
]

const CAT_BORDER: Record<string, string> = {
  emergency:   'border-l-danger',
  maintenance: 'border-l-warning',
  event:       'border-l-primary',
  rule:        'border-l-info',
  general:     'border-l-border',
}

export default function CommunityPage() {
  const qc      = useQueryClient()
  const user    = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''
  const isStaff  = user?.profile.role === 'warden' || user?.profile.role === 'manager'

  const [showForm,  setShowForm]  = useState(false)
  const [title,     setTitle]     = useState('')
  const [content,   setContent]   = useState('')
  const [category,  setCategory]  = useState<Category>('general')
  const [isPinned,  setIsPinned]  = useState(false)
  const [expiresIn, setExpiresIn] = useState('') // days

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements', hostelId],
    queryFn:  () => fetchAnnouncements(hostelId),
    enabled:  !!hostelId,
  })

  const { mutate: post, isPending: posting } = useMutation({
    mutationFn: () => createAnnouncement({
      hostelId,
      postedBy:  user!.id,
      title,
      content,
      category,
      isPinned,
      expiresAt: expiresIn
        ? new Date(Date.now() + Number(expiresIn) * 86400000).toISOString()
        : null,
    }),
    onSuccess: () => {
      toast.success('Announcement posted')
      qc.invalidateQueries({ queryKey: ['announcements', hostelId] })
      resetForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: ['announcements', hostelId] })
    },
  })

  const { mutate: pin } = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => togglePin(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements', hostelId] }),
  })

  function resetForm() {
    setTitle(''); setContent(''); setCategory('general')
    setIsPinned(false); setExpiresIn(''); setShowForm(false)
  }

  function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    post()
  }

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Noticeboard" showBack={false} />

      <div className="pt-14 px-4 space-y-4">

        {/* ── Post announcement form (staff only) ── */}
        {isStaff && (
          <div>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-primary text-white rounded-card px-4 py-3.5 flex items-center gap-3 font-semibold text-[14px] active:scale-[0.98] transition-transform"
              >
                <Plus size={18} />
                Post New Announcement
              </button>
            ) : (
              <div className="bg-surface rounded-card shadow-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[16px] font-bold text-text-primary">New Announcement</p>
                  <button onClick={resetForm} className="p-1.5 rounded-inner hover:bg-surface-raised">
                    <X size={16} className="text-text-tertiary" />
                  </button>
                </div>

                <form onSubmit={handlePost} className="space-y-4">
                  <Input
                    label="Title"
                    placeholder="Main gate closed for maintenance"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                  />

                  <div>
                    <label className="text-[13px] font-semibold text-text-secondary block mb-1.5">
                      Details
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Add more details here..."
                      rows={3}
                      className="w-full bg-surface-raised border border-border rounded-card px-4 py-3 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-[13px] font-semibold text-text-secondary block mb-2">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(({ value, label, color }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setCategory(value)}
                          className={`px-3 py-1.5 rounded-pill text-[12px] font-semibold transition-colors border-2 ${
                            category === value
                              ? 'bg-primary border-primary text-white'
                              : `${color} border-transparent`
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Options row */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-[13px] text-text-secondary flex items-center gap-1">
                        <Pin size={13} /> Pin to top
                      </span>
                    </label>

                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-[13px] text-text-secondary whitespace-nowrap">
                        Expire after
                      </label>
                      <Input
                        type="number"
                        placeholder="7 days"
                        value={expiresIn}
                        onChange={(e) => setExpiresIn(e.target.value)}
                        className="h-9 text-[13px]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" fullWidth onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="dark" fullWidth loading={posting}>
                      Post
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── Announcement list ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-surface rounded-card shadow-card p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton lines={2} />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone size={28} />}
            title="No announcements yet"
            description={isStaff ? 'Post the first announcement for your residents' : 'Your warden hasn\'t posted anything yet'}
          />
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => {
              const catConf  = CATEGORIES.find((c) => c.value === ann.category)
              const borderCol = CAT_BORDER[ann.category] ?? CAT_BORDER.general
              return (
                <div
                  key={ann.id}
                  className={`bg-surface rounded-card shadow-card p-4 border-l-4 ${borderCol}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {ann.is_pinned && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary-light px-2 py-0.5 rounded-pill">
                            <Pin size={10} /> Pinned
                          </span>
                        )}
                        {catConf && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${catConf.color}`}>
                            {catConf.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[15px] font-bold text-text-primary leading-snug">{ann.title}</p>
                      {ann.content && (
                        <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">{ann.content}</p>
                      )}
                      <p className="text-[11px] text-text-tertiary mt-2">{timeAgo(ann.created_at)}</p>
                    </div>

                    {/* Staff actions */}
                    {isStaff && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => pin({ id: ann.id, pinned: !ann.is_pinned })}
                          className={`p-1.5 rounded-inner transition-colors ${ann.is_pinned ? 'text-primary bg-primary-light' : 'text-text-tertiary hover:bg-surface-raised'}`}
                          title={ann.is_pinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin size={15} />
                        </button>
                        <button
                          onClick={() => remove(ann.id)}
                          className="p-1.5 rounded-inner text-text-tertiary hover:text-danger hover:bg-danger-light transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
