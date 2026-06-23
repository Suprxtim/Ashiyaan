import { useState, useCallback } from 'react'
import {
  CheckCircle2, XCircle, ScanLine, AlertTriangle, MapPin, Clock,
  Loader2, LogOut, LogIn, DoorOpen, UserPlus, ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QRScanner } from '../components/QRScanner'
import {
  getStudentByQrToken, useTripExit, useTripReturn, guardCreateTrip,
} from '@/services/gateTrip.service'
import type { TripScanResult } from '@/services/gateTrip.service'
import type { GateTrip, Profile } from '@/types/app.types'
import { formatDate, formatTime, getInitials, getAvatarColor } from '@/lib/utils'

type LeaveRow = { id: string; destination: string | null; to_date: string }

type ScanPhase =
  | { type: 'idle' }
  | { type: 'scanning' }
  | { type: 'processing' }
  | { type: 'loaded'; student: Profile; activeTrip: GateTrip | null; approvedLeave: LeaveRow | null; scannedToken: string }
  | { type: 'curfew_warn'; student: Profile; trip: GateTrip; approvedLeave: LeaveRow | null; scannedToken: string }
  | { type: 'guard_create'; student: Profile }
  | { type: 'success'; result: TripScanResult; action: 'exit' | 'return' | 'created' }
  | { type: 'error'; message: string }

// ── Helpers ───────────────────────────────────────────────────

function getPresetTime(preset: '2h' | 'evening' | 'tonight' | 'tomorrow'): string {
  const d = new Date()
  if (preset === '2h') d.setHours(d.getHours() + 2)
  else if (preset === 'evening') { d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1) }
  else if (preset === 'tonight') { d.setHours(22, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1) }
  else { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0) }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isPastCurfew(curfewTime: string | null | undefined): boolean {
  if (!curfewTime) return false
  const [h, m] = curfewTime.split(':').map(Number)
  const curfew = new Date()
  curfew.setHours(h, m, 0, 0)
  return new Date() >= curfew
}

function formatCurfew(curfewTime: string): string {
  const [h, m] = curfewTime.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return formatTime(d)
}

function isOverdue(trip: GateTrip): boolean {
  return trip.status === 'overdue'
}

// ── Student card ──────────────────────────────────────────────

function StudentCard({ student }: { student: Profile }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-semibold flex-shrink-0"
        style={{ backgroundColor: getAvatarColor(student.full_name) }}
      >
        {getInitials(student.full_name)}
      </div>
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-text-primary truncate">{student.full_name}</p>
        {student.room_number && (
          <span className="inline-block mt-0.5 text-[12px] font-semibold text-primary bg-primary-light rounded-pill px-2.5 py-0.5">
            Room {student.room_number}
          </span>
        )}
      </div>
    </div>
  )
}

function LeaveBadge({ leave }: { leave: LeaveRow }) {
  return (
    <div className="flex items-center gap-2 bg-success-light rounded-inner px-3 py-2">
      <CheckCircle2 size={16} className="text-success flex-shrink-0" />
      <p className="text-[12px] font-semibold text-success">
        Approved Leave{leave.destination ? `: ${leave.destination}` : ''} until {formatDate(leave.to_date, { day: '2-digit', month: 'short' })}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function ScanPage() {
  const user = useAuthStore((s) => s.user)
  const hostel = user?.hostel
  const [phase, setPhase] = useState<ScanPhase>({ type: 'idle' })
  const [cameraError, setCameraError] = useState('')
  const [guardCreateForm, setGuardCreateForm] = useState({
    destination: '', purpose: '', expectedReturn: '',
    selectedPreset: null as '2h' | 'evening' | 'tonight' | 'tomorrow' | null,
    showCustom: false,
  })

  const resetIdle = useCallback(() => {
    setCameraError('')
    setGuardCreateForm({ destination: '', purpose: '', expectedReturn: '', selectedPreset: null, showCustom: false })
    setPhase({ type: 'idle' })
  }, [])

  // ── Scan handler ─────────────────────────────────────────────
  const handleScan = useCallback(async (token: string) => {
    setPhase((prev) => {
      if (prev.type !== 'scanning') return prev
      return { type: 'processing' }
    })

    try {
      const result = await getStudentByQrToken(token)
      if (!result) {
        setPhase({ type: 'error', message: 'Student not found — this QR is not registered.' })
        return
      }
      const { student, activeTrip } = result

      const today = new Date().toISOString().split('T')[0]
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('id, destination, to_date')
        .eq('user_id', student.id)
        .eq('status', 'approved')
        .lte('from_date', today)
        .gte('to_date', today)
        .limit(1)
        .maybeSingle()
      const approvedLeave = (leaveData as LeaveRow | null) ?? null

      setPhase({ type: 'loaded', student, activeTrip, approvedLeave, scannedToken: token })
    } catch {
      setPhase({ type: 'error', message: 'Failed to look up student. Try again.' })
    }
  }, [])

  // ── Approve exit ─────────────────────────────────────────────
  function handleApproveExit(student: Profile, trip: GateTrip, approvedLeave: LeaveRow | null, scannedToken: string) {
    if (!approvedLeave && isPastCurfew(hostel?.curfew_time)) {
      setPhase({ type: 'curfew_warn', student, trip, approvedLeave, scannedToken })
      return
    }
    doApproveExit(scannedToken)
  }

  async function doApproveExit(scannedToken: string) {
    setPhase({ type: 'processing' })
    try {
      const result = await useTripExit(scannedToken)
      setPhase({ type: 'success', result, action: 'exit' })
    } catch (e) {
      setPhase({ type: 'error', message: (e as Error).message })
    }
  }

  async function doLogReturn(scannedToken: string) {
    setPhase({ type: 'processing' })
    try {
      const result = await useTripReturn(scannedToken)
      setPhase({ type: 'success', result, action: 'return' })
    } catch (e) {
      setPhase({ type: 'error', message: (e as Error).message })
    }
  }

  async function doGuardCreate(student: Profile) {
    if (!guardCreateForm.destination.trim() || !guardCreateForm.expectedReturn) {
      toast.error('Destination and return time are required')
      return
    }
    setPhase({ type: 'processing' })
    try {
      const expectedReturnAt = new Date(guardCreateForm.expectedReturn).toISOString()
      const tripId = await guardCreateTrip({
        userId: student.id,
        destination: guardCreateForm.destination.trim(),
        purpose: guardCreateForm.purpose.trim() || undefined,
        expectedReturnAt,
      })
      const result: TripScanResult = {
        trip_id: tripId,
        student_name: student.full_name,
        room_number: student.room_number,
        destination: guardCreateForm.destination.trim(),
        purpose: guardCreateForm.purpose.trim() || null,
        expected_return_at: expectedReturnAt,
        exit_at: new Date().toISOString(),
        linked_leave_id: null,
        duration_minutes: null,
      }
      setPhase({ type: 'success', result, action: 'created' })
      setGuardCreateForm({ destination: '', purpose: '', expectedReturn: '', selectedPreset: null, showCustom: false })
    } catch (e) {
      setPhase({ type: 'error', message: (e as Error).message })
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Scan Gate Pass" showBack />
      <div className="pt-16 px-4 flex flex-col items-center">
        {renderPhase()}
      </div>
    </div>
  )

  function renderPhase() {
    switch (phase.type) {
      // ── idle ──
      case 'idle':
        return (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center">
              <ScanLine size={36} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-text-primary">Scan Gate Pass</p>
              <p className="text-[13px] text-text-secondary mt-1">Point camera at student's QR code</p>
            </div>
            {cameraError && (
              <div className="bg-danger-light rounded-inner px-4 py-2 max-w-xs text-center">
                <p className="text-[13px] text-danger">{cameraError}</p>
              </div>
            )}
            <Button variant="dark" leftIcon={<ScanLine size={16} />} onClick={() => { setCameraError(''); setPhase({ type: 'scanning' }) }}>
              Start Scanning
            </Button>
          </div>
        )

      // ── scanning ──
      case 'scanning':
        return (
          <div className="flex flex-col items-center gap-5 py-4">
            <QRScanner
              active
              onScan={handleScan}
              onError={(msg) => { setCameraError(msg); setPhase({ type: 'idle' }) }}
            />
            <p className="text-[13px] text-text-secondary">Hold the student's QR steady inside the frame</p>
            <Button variant="ghost" onClick={resetIdle}>Cancel</Button>
          </div>
        )

      // ── processing ──
      case 'processing':
        return (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-[14px] font-semibold text-text-secondary">Processing...</p>
          </div>
        )

      // ── loaded ──
      case 'loaded': {
        const { student, activeTrip, approvedLeave, scannedToken } = phase
        const card = (children: React.ReactNode) => (
          <div className="w-full max-w-sm bg-surface rounded-card shadow-card p-5 space-y-4">{children}</div>
        )

        // pending trip → approve exit
        if (activeTrip && activeTrip.status === 'pending') {
          return card(
            <>
              <StudentCard student={student} />
              {approvedLeave && <LeaveBadge leave={approvedLeave} />}
              <div className="space-y-2 border-t border-border pt-3">
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
                {activeTrip.purpose && (
                  <p className="text-[12px] text-text-tertiary italic">{activeTrip.purpose}</p>
                )}
              </div>
              <Button
                fullWidth
                className="bg-success text-white hover:bg-success"
                leftIcon={<LogOut size={16} />}
                onClick={() => handleApproveExit(student, activeTrip, approvedLeave, scannedToken)}
              >
                Approve Exit
              </Button>
              <Button variant="ghost" fullWidth onClick={resetIdle}>Cancel</Button>
            </>,
          )
        }

        // out / overdue trip → log return
        if (activeTrip && (activeTrip.status === 'out' || activeTrip.status === 'overdue')) {
          return card(
            <>
              <StudentCard student={student} />
              {approvedLeave && <LeaveBadge leave={approvedLeave} />}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-[14px] text-text-primary">
                  <DoorOpen size={15} className="text-text-tertiary flex-shrink-0" />
                  <span className="font-semibold">
                    Currently Outside{activeTrip.exit_at ? ` since ${formatTime(activeTrip.exit_at)}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-text-secondary">
                  <MapPin size={14} className="text-text-tertiary flex-shrink-0" />
                  <span>{activeTrip.destination}</span>
                </div>
                {isOverdue(activeTrip) && (
                  <span className="inline-block text-[11px] font-bold text-danger bg-danger-light rounded-pill px-2.5 py-0.5">
                    Overdue
                  </span>
                )}
              </div>
              <Button
                fullWidth
                variant="dark"
                leftIcon={<LogIn size={16} />}
                onClick={() => doLogReturn(scannedToken)}
              >
                Log Return
              </Button>
              <Button variant="ghost" fullWidth onClick={resetIdle}>Cancel</Button>
            </>,
          )
        }

        // no active trip → create trip
        return card(
          <>
            <StudentCard student={student} />
            {approvedLeave && <LeaveBadge leave={approvedLeave} />}
            <div className="bg-surface-raised rounded-inner px-4 py-3 text-center">
              <p className="text-[13px] text-text-secondary">No pending trip for this student</p>
            </div>
            <Button
              fullWidth
              variant="dark"
              leftIcon={<UserPlus size={16} />}
              onClick={() => setPhase({ type: 'guard_create', student })}
            >
              Create Trip
            </Button>
            <Button variant="ghost" fullWidth onClick={resetIdle}>Cancel</Button>
          </>,
        )
      }

      // ── curfew_warn ──
      case 'curfew_warn': {
        const { student, trip, approvedLeave, scannedToken } = phase
        const curfew = hostel?.curfew_time ? formatCurfew(hostel.curfew_time) : ''
        return (
          <div className="w-full max-w-sm bg-warning-light rounded-card p-5 space-y-4 border border-warning/40">
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[16px] font-bold text-warning">Past Curfew</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  {curfew ? `Curfew is ${curfew}. ` : ''}No approved leave on record.
                </p>
              </div>
            </div>
            <div className="bg-surface/70 rounded-inner p-3">
              <StudentCard student={student} />
              <div className="flex items-center gap-2 text-[13px] text-text-secondary mt-2">
                <MapPin size={14} className="text-text-tertiary flex-shrink-0" />
                <span>{trip.destination}</span>
              </div>
            </div>
            <Button
              fullWidth
              variant="danger"
              leftIcon={<LogOut size={16} />}
              onClick={() => { void approvedLeave; doApproveExit(scannedToken) }}
            >
              Confirm Override &amp; Approve Exit
            </Button>
            <Button variant="ghost" fullWidth onClick={resetIdle}>Cancel</Button>
          </div>
        )
      }

      // ── guard_create ──
      case 'guard_create': {
        const { student } = phase
        const presets = [
          { label: '2 hrs', value: '2h' },
          { label: 'Evening', value: 'evening' },
          { label: 'Tonight', value: 'tonight' },
          { label: 'Tomorrow', value: 'tomorrow' },
        ] as const
        return (
          <div className="w-full max-w-sm bg-surface rounded-card shadow-card p-5 space-y-4">
            <StudentCard student={student} />
            <p className="text-[14px] font-bold text-text-primary border-t border-border pt-3">Guard-Initiated Trip</p>
            <Input
              label="Destination"
              placeholder="e.g. City Mall, Home"
              value={guardCreateForm.destination}
              onChange={(e) => setGuardCreateForm((f) => ({ ...f, destination: e.target.value }))}
              leftIcon={<MapPin size={14} />}
              required
            />
            <div>
              <p className="text-[13px] font-semibold text-text-secondary mb-2">Expected return</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setGuardCreateForm((f) => ({
                      ...f, expectedReturn: getPresetTime(p.value), selectedPreset: p.value, showCustom: false,
                    }))}
                    className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
                      guardCreateForm.selectedPreset === p.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface border-border text-text-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setGuardCreateForm((f) => ({ ...f, showCustom: !f.showCustom }))}
                  className={`px-3 py-1.5 rounded-pill text-[13px] font-medium border transition-colors ${
                    guardCreateForm.showCustom ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  Custom
                </button>
              </div>
              {guardCreateForm.showCustom && (
                <input
                  type="datetime-local"
                  value={guardCreateForm.expectedReturn}
                  onChange={(e) => setGuardCreateForm((f) => ({ ...f, expectedReturn: e.target.value, selectedPreset: null }))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-border rounded-inner px-3 py-2 text-[14px] text-text-primary bg-surface"
                />
              )}
              {guardCreateForm.expectedReturn && !guardCreateForm.showCustom && (
                <p className="text-[12px] text-text-tertiary">
                  Return by: {formatDate(new Date(guardCreateForm.expectedReturn), { day: '2-digit', month: 'short' })},{' '}
                  {formatTime(new Date(guardCreateForm.expectedReturn))}
                </p>
              )}
            </div>
            <Input
              label="Purpose (optional)"
              placeholder="e.g. Shopping"
              value={guardCreateForm.purpose}
              onChange={(e) => setGuardCreateForm((f) => ({ ...f, purpose: e.target.value }))}
            />
            <Button
              fullWidth
              variant="dark"
              leftIcon={<LogOut size={16} />}
              onClick={() => doGuardCreate(student)}
            >
              Log Exit &amp; Create Trip
            </Button>
            <Button variant="ghost" fullWidth onClick={resetIdle}>Cancel</Button>
          </div>
        )
      }

      // ── success ──
      case 'success': {
        const { result, action } = phase
        return (
          <div className="w-full max-w-sm bg-success-light rounded-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-success flex-shrink-0" />
              <div>
                <p className="text-[17px] font-bold text-success">
                  {action === 'exit' ? 'Exit Approved' : action === 'return' ? 'Return Logged' : 'Trip Created'}
                </p>
                <p className="text-[14px] font-semibold text-text-primary">{result.student_name}</p>
              </div>
            </div>

            <div className="space-y-2 bg-surface/60 rounded-inner p-3">
              {result.room_number && (
                <Row label="Room" value={result.room_number} />
              )}
              {(action === 'exit' || action === 'created') && (
                <>
                  <Row label="Destination" value={result.destination} />
                  <Row
                    label="Expected return"
                    value={`${formatDate(result.expected_return_at, { day: '2-digit', month: 'short' })}, ${formatTime(result.expected_return_at)}`}
                  />
                </>
              )}
              {action === 'return' && (
                <Row
                  label="Duration outside"
                  value={result.duration_minutes != null ? formatDuration(result.duration_minutes) : '—'}
                />
              )}
              {action === 'created' && (
                <p className="text-[12px] text-text-tertiary pt-1">Guard-initiated exit logged</p>
              )}
            </div>

            <Button fullWidth variant="dark" leftIcon={<ScanLine size={16} />} rightIcon={<ArrowRight size={16} />} onClick={resetIdle}>
              Scan Next
            </Button>
          </div>
        )
      }

      // ── error ──
      case 'error':
        return (
          <div className="w-full max-w-sm bg-danger-light rounded-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <XCircle size={28} className="text-danger flex-shrink-0" />
              <p className="text-[16px] font-bold text-danger">{phase.message}</p>
            </div>
            <Button fullWidth variant="dark" leftIcon={<ScanLine size={16} />} onClick={resetIdle}>
              Try Again
            </Button>
          </div>
        )
    }
  }
}

// ── Small presentational helpers ──────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-text-tertiary">{label}</span>
      <span className="text-[13px] font-semibold text-text-primary text-right">{value}</span>
    </div>
  )
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} min`
}
