import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Home, UtensilsCrossed, Zap, Wrench, HelpCircle, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { usePayments } from '../hooks/usePayments'
import { formatCurrency, formatDate, getInitials, getAvatarColor } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Database } from '@/types/database.types'

type PaymentType   = Database['public']['Enums']['payment_type']
type PaymentStatus = Database['public']['Enums']['payment_status']

const TYPE_ICONS: Record<PaymentType, React.ElementType> = {
  rent:        Home,
  mess:        UtensilsCrossed,
  electricity: Zap,
  maintenance: Wrench,
  other:       HelpCircle,
}

const TYPE_COLORS: Record<PaymentType, string> = {
  rent:        'bg-primary-light text-primary',
  mess:        'bg-success-light text-success',
  electricity: 'bg-warning-light text-warning',
  maintenance: 'bg-info-light text-info',
  other:       'bg-surface-raised text-text-secondary',
}

const STATUS_BADGE: Record<PaymentStatus, { label: string; className: string; Icon: React.ElementType }> = {
  pending:  { label: 'PENDING',  className: 'bg-danger-light text-danger',          Icon: AlertCircle  },
  overdue:  { label: 'OVERDUE',  className: 'bg-danger text-white',                 Icon: AlertCircle  },
  paid:     { label: 'PAID',     className: 'bg-success-light text-success',        Icon: CheckCircle2 },
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export default function PaymentsPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const { payments, paymentsLoading, summary, summaryLoading, currentMonth, paid } = usePayments()
  const [showAllPaid, setShowAllPaid] = useState(false)

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const hostelName  = user?.hostel?.name?.split(' ')[0] ?? 'Block'
  const roomLabel   = user?.profile.room_number
    ? `${hostelName} · Room ${user.profile.room_number}`
    : user?.hostel?.name ?? 'Ashiyaan'

  function handlePayAll() {
    toast('Pay at the hostel office — the warden will mark your dues as paid.', {
      duration: 5000,
      icon: '🏢',
    })
  }

  const daysLeft = daysUntil(summary?.nearestDue ?? null)
  const now      = new Date()
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

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
        <button
          onClick={() => navigate('/notifications')}
          className="p-2 rounded-full hover:bg-surface-raised"
          aria-label="Notifications"
        >
          <Bell size={22} className="text-text-secondary" />
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── Outstanding Card ── */}
        <div className="bg-[#6B3A2A] rounded-card p-5 shadow-raised">
          <p className="text-white/60 text-[12px] uppercase tracking-widest font-semibold">
            Total Outstanding
          </p>
          {summaryLoading ? (
            <div className="skeleton h-10 w-36 mt-2 rounded" style={{ background: 'rgba(255,255,255,0.15)' }} />
          ) : (
            <p className="text-white text-[36px] font-bold mt-1 leading-tight">
              {formatCurrency(summary?.totalOutstanding ?? 0)}
            </p>
          )}

          <div className="flex items-center justify-between mt-4">
            {daysLeft !== null && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} className="text-white/60" />
                <span className="text-white/70 text-[13px]">
                  {daysLeft > 0 ? `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Due today'}
                </span>
              </div>
            )}
            <button
              onClick={handlePayAll}
              className="bg-accent text-text-primary text-[14px] font-bold px-5 py-2 rounded-btn ml-auto active:scale-95 transition-transform"
            >
              How to Pay
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-card shadow-card p-4">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1">Last Paid</p>
            {summaryLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : summary?.lastPaid ? (
              <>
                <p className="text-[17px] font-bold text-text-primary">
                  {formatCurrency(summary.lastPaid.amount)}
                </p>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  {formatDate(summary.lastPaid.paid_date ?? '', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </>
            ) : (
              <p className="text-[14px] text-text-tertiary">No payments yet</p>
            )}
          </div>

          <div className="bg-surface rounded-card shadow-card p-4">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wide mb-1">Pending Items</p>
            {paymentsLoading ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <>
                <p className="text-[17px] font-bold text-warning">
                  {payments.filter((p) => p.status !== 'paid').length}
                </p>
                <p className="text-[12px] text-text-tertiary mt-0.5">unpaid dues</p>
              </>
            )}
          </div>
        </div>

        {/* ── Current Month Breakdown ── */}
        <div>
          <p className="text-[17px] font-bold text-text-primary mb-3">{monthLabel} Bill</p>

          {paymentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-card shadow-card p-4 flex gap-3">
                  <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                  <div className="flex-1"><Skeleton lines={2} /></div>
                </div>
              ))}
            </div>
          ) : currentMonth.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card p-6 text-center">
              <CheckCircle2 size={28} className="text-success mx-auto mb-2" />
              <p className="text-[14px] font-semibold text-text-primary">All clear!</p>
              <p className="text-[13px] text-text-secondary mt-1">No dues this month</p>
            </div>
          ) : (
            <div className="bg-surface rounded-card shadow-card overflow-hidden">
              {currentMonth.map((p, idx) => {
                const Icon    = TYPE_ICONS[p.payment_type] ?? HelpCircle
                const color   = TYPE_COLORS[p.payment_type] ?? TYPE_COLORS.other
                const badge   = STATUS_BADGE[p.status]
                const BadgeIcon = badge.Icon
                return (
                  <div key={p.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-4">
                      <div className={`w-10 h-10 rounded-inner flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">
                          {p.description ?? p.payment_type}
                        </p>
                        {p.due_date && (
                          <p className="text-[12px] text-text-tertiary mt-0.5">
                            Due: {formatDate(p.due_date, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <p className="text-[15px] font-bold text-text-primary">
                          {formatCurrency(p.amount)}
                        </p>
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-pill ${badge.className}`}>
                          <BadgeIcon size={10} />
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Payment History ── */}
        {paid.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-bold text-text-primary">Payment History</p>
              {paid.length > 5 && (
                <button
                  onClick={() => setShowAllPaid((v) => !v)}
                  className="text-[13px] text-primary font-semibold"
                >
                  {showAllPaid ? 'Show Less' : 'View All'}
                </button>
              )}
            </div>
            <div className="bg-surface rounded-card shadow-card overflow-hidden">
              {(showAllPaid ? paid : paid.slice(0, 5)).map((p, idx) => {
                const Icon  = TYPE_ICONS[p.payment_type] ?? HelpCircle
                const color = TYPE_COLORS[p.payment_type] ?? TYPE_COLORS.other
                return (
                  <div key={p.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-inner flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-text-primary truncate">
                          {p.description ?? p.payment_type}
                        </p>
                        <p className="text-[11px] text-text-tertiary">
                          {p.paid_date ? formatDate(p.paid_date, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CheckCircle2 size={13} className="text-success" />
                        <p className="text-[14px] font-bold text-text-primary">
                          {formatCurrency(p.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Coming soon note ── */}
        <div className="bg-info-light rounded-card p-4 flex items-start gap-3">
          <Clock size={18} className="text-info flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Online payment via UPI/Razorpay is coming soon. For now, pay at the hostel office and the warden will mark it as paid.
          </p>
        </div>

      </div>
    </div>
  )
}
