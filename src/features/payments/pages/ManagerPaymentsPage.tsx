import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, formatDate, getInitials, getAvatarColor } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type PaymentStatus = Database['public']['Enums']['payment_status']

const STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string; Icon: React.ElementType }> = {
  pending:  { label: 'Pending',  className: 'bg-warning-light text-warning', Icon: Clock         },
  overdue:  { label: 'Overdue',  className: 'bg-danger text-white',          Icon: AlertCircle   },
  paid:     { label: 'Paid',     className: 'bg-success-light text-success', Icon: CheckCircle2  },
}

async function fetchAllPayments(hostelId: string) {
  const { data } = await supabase
    .from('payments')
    .select('*, profiles(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .order('status', { ascending: true })   // overdue first
    .order('due_date', { ascending: true })
  return data ?? []
}

async function markAsPaid(paymentId: string) {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
    .eq('id', paymentId)
  if (error) throw error
}

export default function ManagerPaymentsPage() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all')

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['all-payments', hostelId],
    queryFn:  () => fetchAllPayments(hostelId),
    enabled:  !!hostelId,
  })

  const { mutate: markPaid, isPending: marking } = useMutation({
    mutationFn: markAsPaid,
    onSuccess: () => {
      toast.success('Payment marked as paid')
      qc.invalidateQueries({ queryKey: ['all-payments', hostelId] })
      qc.invalidateQueries({ queryKey: ['payment-summary'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = payments.filter((p) => {
    const profile = (p as unknown as { profiles: { full_name: string; room_number: string | null } }).profiles
    const matchSearch = !search ||
      profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      profile?.room_number?.includes(search) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.status === filter
    return matchSearch && matchFilter
  })

  const totalPending = payments.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0)
  const totalCollected = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Payments" showBack />

      <div className="pt-14 px-4 space-y-4">

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-danger-light rounded-card p-4">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide mb-1">Outstanding</p>
            <p className="text-[22px] font-bold text-danger">{formatCurrency(totalPending)}</p>
          </div>
          <div className="bg-success-light rounded-card p-4">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide mb-1">Collected</p>
            <p className="text-[22px] font-bold text-success">{formatCurrency(totalCollected)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by name, room or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 bg-surface border border-border rounded-input pl-9 pr-4 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {(['all', 'pending', 'overdue', 'paid'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold capitalize transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-text-secondary'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* Payment list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface rounded-card shadow-card p-6 text-center">
            <CheckCircle2 size={28} className="text-success mx-auto mb-2" />
            <p className="text-[14px] font-semibold text-text-primary">All clear!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const profile = (p as unknown as { profiles: { full_name: string; room_number: string | null; avatar_url: string | null } }).profiles
              const badge   = STATUS_CONFIG[p.status]
              const BadgeIcon = badge.Icon

              return (
                <div key={p.id} className={`bg-surface rounded-card shadow-card overflow-hidden ${p.status === 'overdue' ? 'border-l-4 border-l-danger' : ''}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Student avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                      style={{ backgroundColor: getAvatarColor(profile?.full_name ?? 'U') }}
                    >
                      {getInitials(profile?.full_name ?? 'U')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">
                        {profile?.full_name ?? 'Unknown'}
                      </p>
                      <p className="text-[12px] text-text-tertiary">
                        {profile?.room_number ? `Room ${profile.room_number} · ` : ''}
                        {p.description ?? p.payment_type}
                      </p>
                      {p.due_date && (
                        <p className="text-[11px] text-text-tertiary">
                          Due: {formatDate(p.due_date, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="text-[15px] font-bold text-text-primary">{formatCurrency(p.amount)}</p>
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-pill ${badge.className}`}>
                        <BadgeIcon size={9} />
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Mark as paid button — only for unpaid */}
                  {p.status !== 'paid' && (
                    <div className="border-t border-border px-4 py-2.5">
                      <button
                        onClick={() => markPaid(p.id)}
                        disabled={marking}
                        className="flex items-center gap-2 text-[13px] font-semibold text-success hover:bg-success-light w-full justify-center py-1 rounded-inner transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        Mark as Paid
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
