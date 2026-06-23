import { useState } from 'react'
import { Bell, LogIn, LogOut, Clock, DoorOpen, ChevronRight, UserPlus,
         Phone, Trash2, CalendarDays, MapPin, Loader2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useGateTrip } from '../hooks/useGateTrip'
import { getInitials, getAvatarColor, formatTime, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { getVisitors, createVisitor, cancelVisitor } from '@/services/visitors.service'
import type { GateTrip } from '@/types/app.types'
import type { AuthUser } from '@/types/app.types'

type Tab = 'my' | 'visitor'

// ── Return time preset helpers ────────────────────────────────

function getPresetTime(preset: '2h' | 'evening' | 'tonight' | 'tomorrow'): string {
  const d = new Date()
  if (preset === '2h') {
    d.setHours(d.getHours() + 2)
  } else if (preset === 'evening') {
    d.setHours(20, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
  } else if (preset === 'tonight') {
    d.setHours(22, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
  } else {
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
  }
  // Return as local datetime-local string (YYYY-MM-DDTHH:mm)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Waiting at Gate',
  out:       'Currently Outside',
  overdue:   'Overdue',
  returned:  'Returned',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-warning-light text-warning',
  out:       'bg-primary-light text-primary',
  overdue:   'bg-danger-light text-danger',
  returned:  'bg-success-light text-success',
  cancelled: 'bg-surface-raised text-text-tertiary',
}

const VISITOR_STATUS_STYLE: Record<string, string> = {
  pending:  'bg-warning-light text-warning',
  approved: 'bg-success-light text-success',
  arrived:  'bg-primary-light text-primary',
  left:     'bg-surface-raised text-text-secondary',
  expired:  'bg-surface-raised text-text-tertiary',
}

const VISITOR_STATUS_LABEL: Record<string, string> = {
  pending:  'Pending',
  approved: 'Approved',
  arrived:  'Arrived',
  left:     'Left',
  expired:  'Expired',
}

export default function GatePassPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('my')
  const user = useAuthStore((s) => s.user)
  const { activeTrip, tripLoading, trips, tripsLoading, submitting, cancelling, submitTrip, cancel, qrToken } = useGateTrip()

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const hostelName  = user?.hostel?.name?.split(' ')[0] ?? 'Block'
  const roomLabel   = user?.profile.room_number
    ? `${hostelName} · Room ${user.profile.room_number}`
    : user?.hostel?.name ?? 'Ashiyaan'

  return (
    <div className="min-h-dvh bg-canvas pb-24">

      {/* ── TopBar ── */}
      <div className="bg-surface px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
            style={{ backgroundColor: avatarColor }}>
            {initials}
          </div>
          <div>
            <p className="text-[16px] font-bold text-primary leading-tight">{roomLabel}</p>
            <p className="text-[12px] text-text-tertiary leading-tight">{user?.profile.full_name}</p>
          </div>
        </div>
        <button onClick={() => navigate('/notifications')} className="p-2 rounded-full hover:bg-surface-raised">
          <Bell size={22} className="text-text-secondary" />
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── Tabs ── */}
        <div className="flex bg-surface-raised rounded-inner p-1">
          {(['my', 'visitor'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${
                tab === t ? 'bg-surface text-primary shadow-card' : 'text-text-tertiary'
              }`}>
              {t === 'my' ? 'My Gate Pass' : 'Visitor Passes'}
            </button>
          ))}
        </div>

        {tab === 'my' ? (
          <MyGatePassTab
            user={user}
            qrToken={qrToken}
            activeTrip={activeTrip ?? null}
            tripLoading={tripLoading}
            trips={trips}
            tripsLoading={tripsLoading}
            submitting={submitting}
            cancelling={cancelling}
            submitTrip={submitTrip}
            cancelTrip={cancel}
            navigate={navigate}
          />
        ) : (
          <VisitorTab userId={user?.id ?? ''} hostelId={user?.profile.hostel_id ?? ''} />
        )}

      </div>
    </div>
  )
}

// ── MyGatePassTab ─────────────────────────────────────────────

interface MyGatePassTabProps {
  user: AuthUser | null
  qrToken: string
  activeTrip: GateTrip | null
  tripLoading: boolean
  trips: GateTrip[]
  tripsLoading: boolean
  submitting: boolean
  cancelling: boolean
  submitTrip: (params: { destination: string; purpose?: string; expectedReturnAt: string }) => void
  cancelTrip: (tripId: string) => void
  navigate: (path: string) => void
}

function MyGatePassTab({
  user,
  qrToken,
  activeTrip,
  tripLoading,
  trips,
  tripsLoading,
  submitting,
  cancelling,
  submitTrip,
  cancelTrip,
  navigate,
}: MyGatePassTabProps) {
  const [destination, setDestination]       = useState('')
  const [purpose, setPurpose]               = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [showCustomTime, setShowCustomTime] = useState(false)

  const presets = [
    { label: '2 hrs',   value: '2h'      },
    { label: 'Evening', value: 'evening' },
    { label: 'Tonight', value: 'tonight' },
    { label: 'Tomorrow',value: 'tomorrow'},
  ] as const

  function handlePreset(p: typeof presets[number]['value']) {
    setExpectedReturn(getPresetTime(p))
    setShowCustomTime(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!destination.trim()) { toast.error('Destination is required'); return }
    if (!expectedReturn) { toast.error('Select a return time'); return }
    submitTrip({
      destination: destination.trim(),
      purpose: purpose.trim() || undefined,
      expectedReturnAt: new Date(expectedReturn).toISOString(),
    })
    setDestination(''); setPurpose(''); setExpectedReturn('')
  }

  const isActive = activeTrip && (activeTrip.status === 'pending' || activeTrip.status === 'out' || activeTrip.status === 'overdue')

  return (
    <div className="space-y-5">

      {/* ── Static QR card ── */}
      <div className="bg-surface rounded-card shadow-card overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[17px] font-bold text-text-primary">Digital Gate Pass</p>
          <p className="text-[13px] text-text-tertiary mt-0.5">Show this QR at the gate</p>
        </div>
        {/* QR on teal background */}
        <div className="mx-5 mb-4 bg-primary rounded-inner p-6 flex items-center justify-center">
          {qrToken ? (
            <div className="bg-white rounded-[16px] p-3 shadow-raised">
              <QRCodeSVG value={qrToken} size={180} level="M" fgColor="#1A3D3D" bgColor="#FFFFFF" />
            </div>
          ) : (
            <div className="bg-white/10 rounded-inner flex items-center justify-center w-[180px] h-[180px]">
              <DoorOpen size={40} className="text-white/50" />
            </div>
          )}
        </div>
        {/* Student + room chips */}
        {user && (
          <div className="mx-5 mb-5 grid grid-cols-2 gap-3">
            <div className="bg-surface-raised rounded-inner px-3 py-2">
              <p className="text-[11px] text-text-tertiary mb-0.5">Student</p>
              <p className="text-[13px] font-semibold text-text-primary truncate">{user.profile.full_name}</p>
            </div>
            <div className="bg-surface-raised rounded-inner px-3 py-2">
              <p className="text-[11px] text-text-tertiary mb-0.5">Room</p>
              <p className="text-[13px] font-semibold text-text-primary">{user.profile.room_number ?? '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Active trip status card ── */}
      {tripLoading ? (
        <div className="bg-surface rounded-card shadow-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : isActive && activeTrip ? (
        <div className="bg-surface rounded-card shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-bold text-text-primary">Active Trip</p>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-pill ${STATUS_COLOR[activeTrip.status] ?? 'bg-surface-raised text-text-tertiary'}`}>
              {STATUS_LABEL[activeTrip.status] ?? activeTrip.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[14px] text-text-primary">
            <MapPin size={15} className="text-text-tertiary flex-shrink-0" />
            <span className="font-semibold">{activeTrip.destination}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Clock size={14} className="text-text-tertiary flex-shrink-0" />
            <span>
              Expected return: {formatDate(activeTrip.expected_return_at, { day: '2-digit', month: 'short' })},{' '}
              {formatTime(activeTrip.expected_return_at)}
            </span>
          </div>
          {activeTrip.status === 'pending' && (
            <>
              <p className="text-[13px] text-text-tertiary">
                Waiting for guard to scan your QR at the gate
              </p>
              <Button
                variant="secondary"
                fullWidth
                loading={cancelling}
                onClick={() => cancelTrip(activeTrip.id)}
                leftIcon={<X size={15} />}
              >
                Cancel Trip
              </Button>
            </>
          )}
          {(activeTrip.status === 'out' || activeTrip.status === 'overdue') && activeTrip.exit_at && (
            <div className="flex items-center gap-2 text-[13px] text-text-secondary">
              <LogOut size={14} className="text-text-tertiary flex-shrink-0" />
              <span>Exited at: {formatTime(activeTrip.exit_at)}</span>
            </div>
          )}
          {activeTrip.status === 'overdue' && (
            <p className="text-[12px] font-semibold text-danger">
              You are overdue — please return immediately
            </p>
          )}
        </div>
      ) : null}

      {/* ── Create trip form ── */}
      {!isActive && (
        <div className="bg-surface rounded-card shadow-card p-5 space-y-4">
          <p className="text-[17px] font-bold text-text-primary">Plan Your Outing</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Destination"
              placeholder="e.g. City Mall, Home, College"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              leftIcon={<MapPin size={14} />}
              required
            />
            <Input
              label="Purpose (optional)"
              placeholder="e.g. Shopping, Family visit"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
            <div>
              <p className="text-[13px] font-medium text-text-secondary mb-2">Expected return</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePreset(p.value)}
                    className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
                      expectedReturn === getPresetTime(p.value)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface border-border text-text-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustomTime((v) => !v)}
                  className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
                    showCustomTime ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  Custom
                </button>
              </div>
              {showCustomTime && (
                <input
                  type="datetime-local"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-border rounded-inner px-3 py-2 text-[14px] text-text-primary bg-surface"
                />
              )}
              {expectedReturn && !showCustomTime && (
                <p className="text-[12px] text-text-tertiary">
                  Return by: {formatDate(new Date(expectedReturn), { day: '2-digit', month: 'short' })},{' '}
                  {formatTime(new Date(expectedReturn))}
                </p>
              )}
            </div>
            <Button type="submit" variant="dark" fullWidth loading={submitting}
              leftIcon={<LogOut size={16} />}>
              Submit Trip Request
            </Button>
          </form>
        </div>
      )}

      {/* ── Recent trips ── */}
      {!tripsLoading && trips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[17px] font-bold text-text-primary">Recent Trips</p>
            <button onClick={() => navigate('/gate-pass/history')}
              className="text-[13px] text-primary font-semibold flex items-center gap-0.5">
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {trips.filter(t => t.status !== 'pending').slice(0, 3).map((trip) => (
              <div key={trip.id} className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card">
                <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                  <MapPin size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-text-primary truncate">{trip.destination}</p>
                  <p className="text-[12px] text-text-tertiary">
                    {formatDate(trip.created_at, { day: '2-digit', month: 'short' })}
                    {trip.exit_at ? ` · Out: ${formatTime(trip.exit_at)}` : ''}
                    {trip.return_at ? ` · In: ${formatTime(trip.return_at)}` : ''}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill flex-shrink-0 ${STATUS_COLOR[trip.status] ?? 'bg-surface-raised text-text-tertiary'}`}>
                  {STATUS_LABEL[trip.status] ?? trip.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Visitor Tab ───────────────────────────────────────────────

function VisitorTab({ userId, hostelId }: { userId: string; hostelId: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', purpose: '', date: '', time: '' })

  const today = new Date().toISOString().split('T')[0]

  const { data: visitors = [], isLoading } = useQuery({
    queryKey: ['visitors', userId],
    queryFn:  () => getVisitors(userId),
    enabled:  !!userId,
  })

  const { mutate: add, isPending: adding } = useMutation({
    mutationFn: () => createVisitor({
      hostUserId:   userId,
      hostelId,
      visitorName:  form.name,
      visitorPhone: form.phone,
      purpose:      form.purpose,
      expectedDate: form.date,
      expectedTime: form.time,
    }),
    onSuccess: () => {
      toast.success('Visitor registered')
      qc.invalidateQueries({ queryKey: ['visitors', userId] })
      setForm({ name: '', phone: '', purpose: '', date: '', time: '' })
      setShowForm(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { mutate: cancel } = useMutation({
    mutationFn: cancelVisitor,
    onSuccess:  () => {
      toast.success('Visitor cancelled')
      qc.invalidateQueries({ queryKey: ['visitors', userId] })
    },
  })

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  const upcoming = visitors.filter(
    (v) => (v.status === 'pending' || v.status === 'approved') && v.expected_date >= today
  )
  const past = visitors.filter(
    (v) => (v.status !== 'pending' && v.status !== 'approved') || v.expected_date < today
  )

  return (
    <div className="space-y-5">

      {/* Add visitor form */}
      {showForm ? (
        <div className="bg-surface rounded-card shadow-card p-4 space-y-4">
          <p className="text-[16px] font-bold text-text-primary">Register Visitor</p>
          <form onSubmit={(e) => { e.preventDefault(); add() }} className="space-y-3">
            <Input label="Visitor name" placeholder="Rahul Sharma" value={form.name} onChange={setF('name')} required autoFocus />
            <Input label="Phone number" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={setF('phone')} leftIcon={<Phone size={14} />} required />
            <Input label="Purpose" placeholder="e.g. Family visit" value={form.purpose} onChange={setF('purpose')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Expected date" type="date" value={form.date} onChange={setF('date')} min={today} required />
              <Input label="Expected time" type="time" value={form.time} onChange={setF('time')} />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" fullWidth onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="dark" fullWidth loading={adding}>Register</Button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary text-white rounded-card px-4 py-3.5 flex items-center gap-3 font-semibold text-[14px] active:scale-[0.98] transition-transform"
        >
          <UserPlus size={18} />
          Register New Visitor
        </button>
      )}

      {/* Upcoming visitors */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}
        </div>
      ) : upcoming.length === 0 && !showForm ? (
        <div className="bg-surface rounded-card shadow-card p-6 text-center space-y-2">
          <CalendarDays size={28} className="text-text-tertiary mx-auto" />
          <p className="text-[14px] font-semibold text-text-primary">No upcoming visitors</p>
          <p className="text-[13px] text-text-secondary">Pre-register to speed up gate entry</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <p className="text-[14px] font-bold text-text-primary mb-2">Upcoming</p>
              <div className="space-y-2">
                {upcoming.map((v) => (
                  <div key={v.id} className="bg-surface rounded-card shadow-card px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-[13px] font-bold">{v.visitor_name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary">{v.visitor_name}</p>
                      <p className="text-[12px] text-text-tertiary">
                        {v.visitor_phone} · {formatDate(v.expected_date, { day: '2-digit', month: 'short' })}
                        {v.expected_time ? ` at ${v.expected_time}` : ''}
                      </p>
                      {v.purpose && <p className="text-[12px] text-text-tertiary italic">{v.purpose}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${VISITOR_STATUS_STYLE[v.status] ?? 'bg-surface-raised text-text-secondary'}`}>
                        {VISITOR_STATUS_LABEL[v.status] ?? v.status}
                      </span>
                      <button onClick={() => cancel(v.id)} className="p-1.5 text-text-tertiary hover:text-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-[14px] font-bold text-text-secondary mb-2">Past</p>
              <div className="space-y-2 opacity-60">
                {past.slice(0, 3).map((v) => (
                  <div key={v.id} className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-text-primary">{v.visitor_name}</p>
                      <p className="text-[12px] text-text-tertiary">
                        {formatDate(v.expected_date, { day: '2-digit', month: 'short' })} · {v.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
