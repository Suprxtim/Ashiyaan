import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useLeaveRequests } from '../hooks/useLeaveRequests'
import { TopBar } from '@/components/layout/TopBar'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function NewLeaveRequestPage() {
  const navigate = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const { submit, submitting } = useLeaveRequests()

  const today = new Date().toISOString().split('T')[0]

  const [fromDate,    setFromDate]    = useState(today)
  const [toDate,      setToDate]      = useState(today)
  const [destination, setDestination] = useState('')
  const [reason,      setReason]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.profile.hostel_id) return
    await submit({
      hostelId:    user.profile.hostel_id,
      userId:      user.id,
      reason:      reason.trim(),
      destination: destination.trim() || null,
      fromDate,
      toDate,
    })
    navigate('/leave')
  }

  const datesValid = fromDate >= today && toDate >= fromDate
  const canSubmit  = datesValid && reason.trim().length >= 10 && !submitting

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Apply for Leave" showBack />

      <form onSubmit={handleSubmit} className="pt-14 px-4 space-y-6">

        {/* ── Dates ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Leave Dates
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From"
              type="date"
              value={fromDate}
              min={today}
              onChange={(e) => {
                const v = e.target.value
                setFromDate(v)
                if (toDate < v) setToDate(v)
              }}
              required
            />
            <Input
              label="To"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              required
            />
          </div>
          {!datesValid && (
            <p className="text-[12px] text-danger mt-1">Return date must be on or after the departure date</p>
          )}
        </div>

        {/* ── Destination ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Destination (Optional)
          </p>
          <Input
            placeholder="e.g. Home, Pune"
            value={destination}
            onChange={(e) => setDestination(e.target.value.slice(0, 100))}
          />
        </div>

        {/* ── Reason ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Reason for Leave
          </p>
          <div className="relative">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              placeholder="Briefly describe why you need this leave..."
              rows={5}
              className="w-full bg-surface-raised border border-border rounded-card px-4 py-3 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
            />
            <span className="absolute bottom-3 right-3 text-[11px] text-text-tertiary">
              {reason.length} / 300
            </span>
          </div>
          {reason.length > 0 && reason.trim().length < 10 && (
            <p className="text-[12px] text-danger mt-1">Minimum 10 characters</p>
          )}
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
          Submit Request
        </Button>

      </form>
    </div>
  )
}
