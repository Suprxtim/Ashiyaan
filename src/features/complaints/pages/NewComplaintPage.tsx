import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Droplets, Wifi, Sparkles, Armchair, MoreHorizontal,
  ImagePlus, X,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useComplaints } from '../hooks/useComplaints'
import { uploadComplaintPhoto } from '@/services/complaints.service'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import type { Database } from '@/types/database.types'

type Category = Database['public']['Enums']['complaint_category']
type Priority = Database['public']['Enums']['complaint_priority']

const CATEGORIES: { value: Category; label: string; Icon: React.ElementType }[] = [
  { value: 'electrical', label: 'Electrical', Icon: Zap      },
  { value: 'plumbing',   label: 'Plumbing',   Icon: Droplets },
  { value: 'wifi',       label: 'WiFi',        Icon: Wifi     },
  { value: 'cleaning',   label: 'Cleaning',   Icon: Sparkles },
  { value: 'furniture',  label: 'Furniture',  Icon: Armchair },
  { value: 'other',      label: 'Other',      Icon: MoreHorizontal },
]

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low',    label: 'Low'    },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High'   },
  { value: 'urgent', label: 'Urgent' },
]

export default function NewComplaintPage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const { submit, submitting } = useComplaints()

  const [category,    setCategory]    = useState<Category | null>(null)
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [priority,    setPriority]    = useState<Priority>('medium')
  const [photos,      setPhotos]      = useState<string[]>([])
  const [previews,    setPreviews]    = useState<string[]>([])
  const [uploading,   setUploading]   = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  function handleCategorySelect(value: Category) {
    setCategory(value)
    // Pre-fill a default title only when the user hasn't typed one yet
    if (!title) {
      setTitle(`${value.charAt(0).toUpperCase() + value.slice(1)} issue`)
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !user) return
    if (photos.length + files.length > 3) { return }
    setUploading(true)
    try {
      const urls = await Promise.all(files.map((f) => uploadComplaintPhoto(f, user.id)))
      setPhotos((p) => [...p, ...urls])
      setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))])
    } catch {
      /* upload error handled by service */
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(idx: number) {
    setPhotos((p)    => p.filter((_, i) => i !== idx))
    setPreviews((p)  => p.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category || !user?.profile.hostel_id) return
    await submit({
      hostelId:    user.profile.hostel_id,
      userId:      user.id,
      category,
      title:       title.trim(),
      description,
      priority,
      photos,
    })
    navigate('/complaints')
  }

  const canSubmit = !!category && title.trim().length >= 3 && description.length >= 20 && !submitting && !uploading

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="New Complaint" showBack />

      <form onSubmit={handleSubmit} className="pt-14 px-4 space-y-6">

        {/* ── Category grid ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Select Category
          </p>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map(({ value, label, Icon }) => {
              const selected = category === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleCategorySelect(value)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-card border-2 transition-all active:scale-95 ${
                    selected
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-border hover:border-primary/30'
                  }`}
                >
                  <Icon size={22} className={selected ? 'text-white' : 'text-primary'} />
                  <span className={`text-[12px] font-semibold ${selected ? 'text-white' : 'text-text-primary'}`}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Title ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Issue Title
          </p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Brief summary of the issue"
            className="w-full bg-surface-raised border border-border rounded-card px-4 py-3 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            required
          />
          {title.length > 0 && title.trim().length < 3 && (
            <p className="text-[12px] text-danger mt-1">Title must be at least 3 characters</p>
          )}
        </div>

        {/* ── Description ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Issue Description
          </p>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Describe the issue..."
              rows={5}
              className="w-full bg-surface-raised border border-border rounded-card px-4 py-3 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
            />
            <span className="absolute bottom-3 right-3 text-[11px] text-text-tertiary">
              {description.length} / 500
            </span>
          </div>
          {description.length > 0 && description.length < 20 && (
            <p className="text-[12px] text-danger mt-1">Minimum 20 characters</p>
          )}
        </div>

        {/* ── Priority ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Priority Level
          </p>
          <div className="flex gap-2">
            {PRIORITIES.map(({ value, label }) => {
              const selected = priority === value
              const urgentColor = value === 'urgent' && selected ? 'bg-danger border-danger text-white' : ''
              const highColor   = value === 'high'   && selected ? 'bg-warning border-warning text-white' : ''
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`flex-1 py-2 rounded-pill border-2 text-[13px] font-semibold transition-all ${
                    urgentColor || highColor ||
                    (selected
                      ? 'bg-primary border-primary text-white'
                      : 'bg-surface border-border text-text-secondary')
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Photos ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Add Photos (Max 3)
          </p>
          <div className="flex gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-card overflow-hidden flex-shrink-0">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}

            {photos.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 rounded-card border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-tertiary hover:border-primary/40 transition-colors flex-shrink-0"
              >
                <ImagePlus size={22} />
                <span className="text-[10px]">{uploading ? 'Uploading…' : 'Add Photo'}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* ── Submit ── */}
        <Button
          type="submit"
          fullWidth
          variant="dark"
          loading={submitting}
          disabled={!canSubmit}
          size="lg"
        >
          Submit Complaint
        </Button>

      </form>
    </div>
  )
}
