import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bell, QrCode, UtensilsCrossed, CreditCard, Receipt,
  LogIn, LogOut, ChevronRight, Utensils, AlertTriangle,
  IndianRupee, Wrench, Calendar,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { fetchDashboardStats, fetchAnnouncements, fetchRecentActivity, fetchRecentComplaints } from '@/services/dashboard.service'
import { fetchRecentLeave, cancelLeaveRequest, type LeaveRequest } from '@/services/leaveRequest.service'
import { getExpenses, getBalances } from '@/services/expenses.service'
import { formatCurrency, formatTime, getInitials, getAvatarColor, timeAgo } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import type { Announcement } from '@/types/app.types'

const CATEGORY_LABEL: Record<string, string> = {
  electrical: 'Electrical', plumbing: 'Plumbing', cleaning: 'Cleaning',
  furniture: 'Furniture', wifi: 'Wi-Fi', other: 'Other',
}

const ANN_BG: Record<string, string> = {
  emergency:   'bg-[#6B3A2A]',
  maintenance: 'bg-[#6B3A2A]',
  event:       'bg-primary',
  rule:        'bg-[#7A6010]',
  general:     'bg-primary',
}

export default function DashboardPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)

  const hostelId   = user?.profile.hostel_id ?? ''
  const userId     = user?.id ?? ''
  const propType   = user?.hostel?.property_type ?? 'hostel'
  const isShared   = propType === 'shared'
  const isPg       = propType === 'pg'
  const isManager  = user?.profile.role === 'warden' || user?.profile.role === 'manager'

  // ── Hostel stats — disabled for managers so no wasted fetches ──
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn:  () => fetchDashboardStats(userId, hostelId),
    enabled:  !!userId && !isShared && !isManager,
  })

  // ── Shared apartment stats ──
  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['balances', hostelId, userId],
    queryFn:  () => getBalances(hostelId, userId),
    enabled:  !!hostelId && isShared && !isManager,
  })

  const { data: recentExpenses = [], isLoading: expLoading } = useQuery({
    queryKey: ['expenses', hostelId],
    queryFn:  () => getExpenses(hostelId),
    enabled:  !!hostelId && isShared && !isManager,
  })

  // ── Shared (hostel) data ──
  const { data: announcements = [], isLoading: annLoading } = useQuery({
    queryKey: ['announcements', hostelId],
    queryFn:  () => fetchAnnouncements(hostelId),
    enabled:  !!hostelId && !isManager,
  })

  // ── Hostel-only — gate pass history ──
  const { data: activity = [], isLoading: actLoading } = useQuery({
    queryKey: ['recent-activity', userId],
    queryFn:  () => fetchRecentActivity(userId),
    enabled:  !!userId && !isShared && !isPg && !isManager,
  })

  // ── PG-only — recent complaints (no gate pass to show instead) ──
  const { data: recentComplaints = [], isLoading: complaintsRecentLoading } = useQuery({
    queryKey: ['recent-complaints', userId],
    queryFn:  () => fetchRecentComplaints(userId),
    enabled:  !!userId && isPg && !isManager,
  })

  const qc = useQueryClient()

  const { data: recentLeave, isLoading: leaveLoading } = useQuery({
    queryKey: ['leave-recent', userId],
    queryFn:  () => fetchRecentLeave(userId),
    enabled:  !!userId && !isShared && !isManager,
  })

  const { mutate: cancelLeave, isPending: leaveCancelling } = useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(id, userId),
    onSuccess: () => {
      toast.success('Leave request cancelled')
      qc.invalidateQueries({ queryKey: ['leave-recent', userId] })
      qc.invalidateQueries({ queryKey: ['leave-requests', userId] })
    },
    onError: () => toast.error('Failed to cancel'),
  })

  // Managers/wardens go to their own dashboard — placed AFTER all hooks
  if (isManager) {
    return <Navigate to="/manager" replace />
  }

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const hostelName  = user?.hostel?.name ?? 'Ashiyaan'
  const roomLabel   = user?.profile.room_number
    ? `${hostelName.split(' ')[0]} · Room ${user.profile.room_number}`
    : hostelName

  const statsIsLoading = isShared ? balancesLoading : statsLoading

  return (
    <div className="min-h-dvh bg-canvas pb-24">

      {/* ── TopBar ── */}
      <div className="bg-surface px-4 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 shadow-card">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0 border-2 border-primary/20"
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
          className="p-2 rounded-full hover:bg-surface-raised transition-colors"
          aria-label="Notifications"
        >
          <Bell size={22} className="text-text-secondary" />
        </button>
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          {isShared ? (
            <>
              <StatCard
                icon={<Receipt size={18} className="text-primary" />}
                label="You're Owed"
                value={statsIsLoading ? null : formatCurrency(balances?.iAmOwed ?? 0)}
                valueColor="text-success"
              />
              <StatCard
                icon={<AlertTriangle size={18} className="text-warning" />}
                label="Open Issues"
                value={statsIsLoading ? null : String(stats?.openIssues ?? 0).padStart(2, '0')}
                valueColor="text-warning"
              />
              <StatCard
                icon={<IndianRupee size={18} className="text-danger" />}
                label="You Owe"
                value={statsIsLoading ? null : formatCurrency(balances?.iOwe ?? 0)}
                valueColor="text-danger"
              />
            </>
          ) : (
            <>
              <StatCard
                icon={<Utensils size={18} className="text-primary" />}
                label="Today's Meals"
                value={statsIsLoading ? null : `${stats?.mealsToday ?? 3}/3`}
              />
              <StatCard
                icon={<AlertTriangle size={18} className="text-warning" />}
                label="Open Issues"
                value={statsIsLoading ? null : String(stats?.openIssues ?? 0).padStart(2, '0')}
                valueColor="text-warning"
              />
              <StatCard
                icon={<IndianRupee size={18} className="text-danger" />}
                label="Amount Due"
                value={statsIsLoading ? null : formatCurrency(stats?.amountDue ?? 0)}
                valueColor="text-danger"
              />
            </>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-3">
            {isShared ? (
              <>
                <QuickAction
                  icon={<Receipt size={26} className="text-white" />}
                  label="Split Expense"
                  className="bg-primary"
                  labelClass="text-white"
                  onClick={() => navigate('/expenses')}
                />
                <QuickAction
                  icon={<Wrench size={26} className="text-primary" />}
                  label="Report Issue"
                  className="bg-surface border-2 border-dashed border-border"
                  labelClass="text-primary"
                  onClick={() => navigate('/complaints/new')}
                />
                <QuickAction
                  icon={<CreditCard size={26} className="text-text-on-accent" />}
                  label="Pay Dues"
                  className="bg-accent"
                  labelClass="text-text-on-accent"
                  onClick={() => navigate('/payments')}
                />
                <QuickAction
                  icon={<span className="text-danger text-[20px] font-black tracking-tight">SOS</span>}
                  label="SOS"
                  className="bg-danger-light"
                  labelClass="text-danger"
                  onClick={() => navigate('/emergency')}
                />
              </>
            ) : isPg ? (
              <>
                <QuickAction
                  icon={<UtensilsCrossed size={26} className="text-white" />}
                  label="Opt Meals"
                  className="bg-primary"
                  labelClass="text-white"
                  onClick={() => navigate('/mess')}
                />
                <QuickAction
                  icon={<Wrench size={26} className="text-primary" />}
                  label="Report Issue"
                  className="bg-surface border-2 border-dashed border-border"
                  labelClass="text-primary"
                  onClick={() => navigate('/complaints/new')}
                />
                <QuickAction
                  icon={<CreditCard size={26} className="text-text-on-accent" />}
                  label="Pay Dues"
                  className="bg-accent"
                  labelClass="text-text-on-accent"
                  onClick={() => navigate('/payments')}
                />
                <QuickAction
                  icon={<span className="text-danger text-[20px] font-black tracking-tight">SOS</span>}
                  label="SOS"
                  className="bg-danger-light"
                  labelClass="text-danger"
                  onClick={() => navigate('/emergency')}
                />
              </>
            ) : (
              <>
                <QuickAction
                  icon={<QrCode size={26} className="text-white" />}
                  label="Generate Pass"
                  className="bg-primary"
                  labelClass="text-white"
                  onClick={() => navigate('/gate-pass')}
                />
                <QuickAction
                  icon={<UtensilsCrossed size={26} className="text-primary" />}
                  label="Opt Meals"
                  className="bg-surface border-2 border-dashed border-border"
                  labelClass="text-primary"
                  onClick={() => navigate('/mess')}
                />
                <QuickAction
                  icon={<CreditCard size={26} className="text-text-on-accent" />}
                  label="Pay Dues"
                  className="bg-accent"
                  labelClass="text-text-on-accent"
                  onClick={() => navigate('/payments')}
                />
                <QuickAction
                  icon={<span className="text-danger text-[20px] font-black tracking-tight">SOS</span>}
                  label="SOS"
                  className="bg-danger-light"
                  labelClass="text-danger"
                  onClick={() => navigate('/emergency')}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Leave / Outpass ── */}
        {!isShared && !isManager && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                Leave / Outpass
              </p>
              <button
                onClick={() => navigate('/leave')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            <LeaveCard
              request={recentLeave}
              isLoading={leaveLoading}
              cancelling={leaveCancelling}
              onCancel={cancelLeave}
              onNavigate={navigate}
            />
          </div>
        )}

        {/* ── Announcements ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[17px] font-bold text-text-primary">Announcements</p>
            <button
              onClick={() => navigate('/community')}
              className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          {annLoading ? (
            <div className="flex gap-3">
              <div className="skeleton w-52 h-36 rounded-card flex-shrink-0" />
              <div className="skeleton w-52 h-36 rounded-card flex-shrink-0" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card p-4 text-center">
              <p className="text-[13px] text-text-tertiary">No announcements yet</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
              {announcements.map((ann) => (
                <AnnouncementCard key={ann.id} ann={ann as Announcement} />
              ))}
            </div>
          )}
        </div>

        {/* ── Recent Activity (hostel) / Recent Expenses (shared) ── */}
        {isShared ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-bold text-text-primary">Recent Expenses</p>
              <button
                onClick={() => navigate('/expenses')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            {expLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-3 shadow-card flex gap-3">
                    <Skeleton circle className="w-9 h-9 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="bg-surface rounded-card shadow-card p-4 text-center">
                <p className="text-[13px] text-text-tertiary italic">No expenses yet — add your first one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentExpenses.slice(0, 4).map((exp) => {
                  const paidByProfile = exp.profiles
                  const splits = exp.expense_splits ?? []
                  const mySplit = splits.find((s) => s.user_id === userId)
                  const iPayee  = exp.paid_by === userId
                  return (
                    <div
                      key={exp.id}
                      onClick={() => navigate('/expenses')}
                      className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <div className="w-9 h-9 rounded-inner bg-primary-light flex items-center justify-center flex-shrink-0">
                        <Receipt size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">{exp.title}</p>
                        <p className="text-[12px] text-text-tertiary">
                          Paid by {iPayee ? 'you' : paidByProfile?.full_name?.split(' ')[0] ?? 'someone'} · {timeAgo(exp.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <p className="text-[14px] font-bold text-text-primary">{formatCurrency(exp.total_amount)}</p>
                        {mySplit && !iPayee && (
                          <p className={`text-[11px] font-semibold ${mySplit.is_paid ? 'text-success' : 'text-danger'}`}>
                            {mySplit.is_paid ? 'settled' : `owe ${formatCurrency(mySplit.amount)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : isPg ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-bold text-text-primary">Recent Complaints</p>
              <button
                onClick={() => navigate('/complaints')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            {complaintsRecentLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-3 shadow-card flex gap-3">
                    <Skeleton circle className="w-9 h-9 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : recentComplaints.length === 0 ? (
              <div className="bg-surface rounded-card shadow-card p-4 text-center">
                <p className="text-[13px] text-text-tertiary italic">No complaints yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentComplaints.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate('/complaints')}
                    className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="w-9 h-9 rounded-inner bg-primary-light flex items-center justify-center flex-shrink-0">
                      <Wrench size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">{c.title}</p>
                      <p className="text-[12px] text-text-tertiary">
                        {CATEGORY_LABEL[c.category] ?? c.category} · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    <Badge variant={c.status} className="flex-shrink-0">
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-bold text-text-primary">Recent Activity</p>
              <button
                onClick={() => navigate('/gate-pass/history')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            {actLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface rounded-card p-3 shadow-card flex gap-3">
                    <Skeleton circle className="w-9 h-9 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="bg-surface rounded-card shadow-card p-4 text-center">
                <p className="text-[13px] text-text-tertiary italic">No gate activity yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((trip) => {
                  const isOut = trip.status === 'out' || trip.status === 'overdue'
                  return (
                    <div
                      key={trip.id}
                      className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isOut ? 'bg-danger-light' : 'bg-success-light'
                      }`}>
                        {isOut
                          ? <LogOut size={16} className="text-danger" />
                          : <LogIn  size={16} className="text-success" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">
                          {trip.destination}
                        </p>
                        <p className="text-[12px] text-text-tertiary">
                          {formatTime(trip.exit_at)} · {timeAgo(trip.exit_at)}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill flex-shrink-0 ${
                        trip.status === 'returned'  ? 'bg-success-light text-success'       :
                        trip.status === 'overdue'   ? 'bg-danger-light text-danger'         :
                        trip.status === 'out'       ? 'bg-warning-light text-warning'       :
                                                      'bg-surface-raised text-text-tertiary'
                      }`}>
                        {trip.status === 'returned' ? 'Returned' :
                         trip.status === 'overdue'  ? 'Overdue'  :
                         trip.status === 'out'      ? 'Outside'  :
                         trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function StatCard({ icon, label, value, valueColor = 'text-text-primary' }: {
  icon: React.ReactNode; label: string; value: string | null; valueColor?: string
}) {
  return (
    <div className="bg-surface rounded-card shadow-card p-3 flex flex-col gap-1.5">
      {icon}
      {value === null
        ? <Skeleton className="h-6 w-10 mt-1" />
        : <p className={`text-[20px] font-bold leading-tight ${valueColor}`}>{value}</p>}
      <p className="text-[11px] text-text-tertiary leading-tight">{label}</p>
    </div>
  )
}

function QuickAction({ icon, label, className, labelClass, onClick }: {
  icon: React.ReactNode; label: string; className: string; labelClass: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`${className} rounded-card p-5 flex flex-col items-center justify-center gap-3 active:scale-[0.97] transition-transform min-h-[110px] w-full`}
    >
      {icon}
      <span className={`text-[14px] font-bold ${labelClass}`}>{label}</span>
    </button>
  )
}

function AnnouncementCard({ ann }: { ann: Announcement }) {
  const bg = ANN_BG[ann.category] ?? 'bg-primary'
  return (
    <div className={`${bg} rounded-card p-4 flex-shrink-0 w-[200px] flex flex-col justify-between min-h-[140px]`}>
      <div>
        <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wide capitalize mb-1.5">
          {ann.category}
        </p>
        <p className="text-[15px] font-bold text-white leading-snug line-clamp-3">{ann.title}</p>
      </div>
      {ann.content && (
        <p className="text-[12px] text-white/75 mt-2 line-clamp-2 leading-snug">{ann.content}</p>
      )}
    </div>
  )
}

function LeaveCard({
  request,
  isLoading,
  cancelling,
  onCancel,
  onNavigate,
}: {
  request: LeaveRequest | null | undefined
  isLoading: boolean
  cancelling: boolean
  onCancel: (id: string) => void
  onNavigate: (path: string) => void
}) {
  if (isLoading) {
    return (
      <div className="bg-surface rounded-card shadow-card p-4 flex items-center gap-3">
        <Skeleton circle className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1"><Skeleton lines={2} /></div>
      </div>
    )
  }

  const fmtDate = (d: string) => {
    const [, m, day] = d.split('-')
    return `${+day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]}`
  }

  if (!request) {
    return (
      <button
        onClick={() => onNavigate('/leave/new')}
        className="w-full bg-surface rounded-card shadow-card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform text-left"
      >
        <div className="w-10 h-10 rounded-inner bg-primary-light flex items-center justify-center flex-shrink-0">
          <Calendar size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-text-primary">Outpass / Leave</p>
          <p className="text-[12px] text-text-tertiary">Plan a trip or overnight stay</p>
        </div>
        <span className="text-[13px] text-primary font-semibold flex-shrink-0">Apply →</span>
      </button>
    )
  }

  const dest      = request.destination ?? 'Leave'
  const dateRange = `${fmtDate(request.from_date)} – ${fmtDate(request.to_date)}`

  if (request.status === 'pending') {
    return (
      <div
        onClick={() => onNavigate('/leave')}
        className="bg-surface rounded-card shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-inner bg-warning-light flex items-center justify-center flex-shrink-0">
            <Calendar size={18} className="text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary truncate">Going to {dest}</p>
            <p className="text-[12px] text-text-tertiary">{dateRange}</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-warning-light text-warning flex-shrink-0">
            Pending
          </span>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(request.id) }}
            disabled={cancelling}
            className="text-[13px] text-danger font-semibold disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel Request'}
          </button>
        </div>
      </div>
    )
  }

  if (request.status === 'approved') {
    return (
      <div
        onClick={() => onNavigate('/leave')}
        className="bg-surface rounded-card shadow-card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="w-10 h-10 rounded-inner bg-success-light flex items-center justify-center flex-shrink-0">
          <Calendar size={18} className="text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-text-primary truncate">Going to {dest}</p>
          <p className="text-[12px] text-text-tertiary">{dateRange}</p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-success-light text-success flex-shrink-0">
          Approved ✓
        </span>
      </div>
    )
  }

  if (request.status === 'rejected') {
    return (
      <div
        onClick={() => onNavigate('/leave/new')}
        className="bg-surface rounded-card shadow-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-inner bg-danger-light flex items-center justify-center flex-shrink-0">
            <Calendar size={18} className="text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">Leave Request</p>
            <p className="text-[12px] text-text-tertiary">{dateRange}</p>
            {request.review_note && (
              <p className="text-[12px] text-danger mt-0.5 line-clamp-1">{request.review_note}</p>
            )}
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-danger-light text-danger flex-shrink-0">
            Rejected
          </span>
        </div>
        <div className="mt-3 flex justify-end">
          <span className="text-[13px] text-primary font-semibold">Apply Again →</span>
        </div>
      </div>
    )
  }

  return null
}
