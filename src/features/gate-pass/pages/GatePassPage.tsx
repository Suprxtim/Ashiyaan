import { useState } from 'react'
import { Bell, LogIn, LogOut, Clock, DoorOpen, ChevronRight, UserPlus, Phone, Trash2, CalendarDays } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { useGatePass } from '../hooks/useGatePass'
import { getInitials, getAvatarColor, formatTime, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { getVisitors, createVisitor, cancelVisitor } from '@/services/visitors.service'

type Tab = 'my' | 'visitor'

export default function GatePassPage() {
  const navigate   = useNavigate()
  const [tab, setTab] = useState<Tab>('my')
  const user       = useAuthStore((s) => s.user)
  const { activePass, passLoading, history, historyLoading, secondsLeft, generating, generate } = useGatePass()

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const hostelName  = user?.hostel?.name?.split(' ')[0] ?? 'Block'
  const roomLabel   = user?.profile.room_number
    ? `${hostelName} · Room ${user.profile.room_number}`
    : user?.hostel?.name ?? 'Ashiyaan'

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')
  const isExpiringSoon = secondsLeft > 0 && secondsLeft <= 60
  const progressPct = activePass
    ? (secondsLeft / 300) * 100
    : 0

  return (
    <div className="min-h-dvh bg-canvas pb-24">

      {/* ── TopBar ── */}
      <div className="bg-surface px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 shadow-card">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <div>
            <p className="text-[16px] font-bold text-primary leading-tight">{roomLabel}</p>
            <p className="text-[12px] text-text-tertiary leading-tight">{user?.profile.full_name}</p>
          </div>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-raised" aria-label="Notifications">
          <Bell size={22} className="text-text-secondary" />
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── Tabs ── */}
        <div className="flex bg-surface-raised rounded-inner p-1">
          {(['my', 'visitor'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-sm transition-colors ${
                tab === t
                  ? 'bg-surface text-primary shadow-card'
                  : 'text-text-tertiary'
              }`}
            >
              {t === 'my' ? 'My Passes' : 'Visitor Passes'}
            </button>
          ))}
        </div>

        {tab === 'my' ? (
          <>
            {/* ── Pass Card ── */}
            {passLoading ? (
              <div className="bg-surface rounded-card shadow-card p-5 space-y-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-48 w-full rounded-inner" />
                <Skeleton className="h-10 w-full rounded-btn" />
              </div>
            ) : (
              <div className="bg-surface rounded-card shadow-card overflow-hidden">

                {/* Card header */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                  <div>
                    <p className="text-[17px] font-bold text-text-primary">Digital Gate Pass</p>
                    <p className="text-[13px] text-primary mt-0.5">Valid for single exit/entry</p>
                  </div>
                  {activePass && (
                    <span className="bg-success-light text-success text-[11px] font-bold px-3 py-1 rounded-pill uppercase">
                      Active
                    </span>
                  )}
                </div>

                {/* QR area — phone mockup on teal bg */}
                <div className="mx-5 mb-4 bg-primary rounded-inner p-6 flex items-center justify-center">
                  {activePass ? (
                    <div className="bg-white rounded-[16px] p-3 shadow-raised relative">
                      {/* Phone notch */}
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-[#E8E2DA] rounded-full" />
                      <div className="mt-2">
                        <QRCodeSVG
                          value={activePass.qr_token}
                          size={180}
                          level="M"
                          fgColor="#1A3D3D"
                          bgColor="#FFFFFF"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/10 rounded-inner flex items-center justify-center w-[180px] h-[180px]">
                      <div className="text-center">
                        <DoorOpen size={40} className="text-white/50 mx-auto mb-2" />
                        <p className="text-white/70 text-[13px]">No active pass</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Countdown */}
                {activePass && (
                  <div className="mx-5 mb-4">
                    <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${isExpiringSoon ? 'bg-danger' : 'bg-primary'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1.5">
                      <span className="flex items-center gap-1 text-[12px] text-text-tertiary">
                        <Clock size={12} />
                        Expires in
                      </span>
                      <span className={`text-[14px] font-bold tabular-nums ${isExpiringSoon ? 'text-danger' : 'text-text-primary'}`}>
                        {mins}:{secs}
                      </span>
                    </div>
                  </div>
                )}

                {/* Student + Room chips */}
                {user && (
                  <div className="mx-5 mb-4 grid grid-cols-2 gap-3">
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

                {/* Generated time */}
                {activePass && (
                  <div className="mx-5 mb-4 flex items-center gap-1.5 text-[12px] text-text-tertiary">
                    <Clock size={13} />
                    Generated: {formatDate(activePass.generated_at, { day: '2-digit', month: 'short' })}, {formatTime(activePass.generated_at)}
                  </div>
                )}

                {/* Generate buttons */}
                <div className="px-5 pb-5 space-y-2">
                  {activePass ? (
                    <Button
                      variant="dark"
                      fullWidth
                      loading={generating}
                      onClick={() => generate('exit')}
                      leftIcon={<LogOut size={16} />}
                    >
                      Generate Exit Pass
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="dark"
                        fullWidth
                        loading={generating}
                        onClick={() => generate('entry')}
                        leftIcon={<LogIn size={16} />}
                      >
                        Generate Entry Pass
                      </Button>
                      <Button
                        variant="secondary"
                        fullWidth
                        loading={generating}
                        onClick={() => generate('exit')}
                        leftIcon={<LogOut size={16} />}
                      >
                        Generate Exit Pass
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Recent History ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[17px] font-bold text-text-primary">Recent History</p>
                <button
                  onClick={() => navigate('/gate-pass/history')}
                  className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>

              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-surface rounded-card p-3 flex gap-3 shadow-card">
                      <Skeleton circle className="w-9 h-9" />
                      <div className="flex-1"><Skeleton lines={2} /></div>
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-[13px] text-text-tertiary italic">No passes generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((pass) => (
                    <div key={pass.id} className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        pass.pass_type === 'exit' ? 'bg-danger-light' : 'bg-success-light'
                      }`}>
                        {pass.pass_type === 'exit'
                          ? <LogOut size={16} className="text-danger" />
                          : <LogIn  size={16} className="text-success" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary capitalize">
                          Campus {pass.pass_type === 'exit' ? 'Exit' : 'Entry'}
                        </p>
                        <p className="text-[12px] text-text-tertiary">
                          {formatDate(pass.generated_at, { day: '2-digit', month: 'short' })}, {formatTime(pass.generated_at)}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill flex-shrink-0 ${
                        pass.status === 'used'    ? 'bg-surface-raised text-text-tertiary' :
                        pass.status === 'active'  ? 'bg-success-light text-success'        :
                                                    'bg-surface-raised text-text-tertiary'
                      }`}>
                        {pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <VisitorTab userId={user?.id ?? ''} hostelId={user?.profile.hostel_id ?? ''} />
        )}
      </div>
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
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-success-light text-success">
                        Approved
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
