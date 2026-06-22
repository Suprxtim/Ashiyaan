import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, LogOut, Users, AlertTriangle, IndianRupee,
  UtensilsCrossed, ChevronRight, CheckCircle2, Clock, Flame, ScanLine,
  Building2, TrendingUp, Timer, UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import {
  getManagerStats, getMessOccupancy, getLiveGateMovements,
  getOpenComplaints, updateComplaintStatus, getPendingPayments,
  getManagerAnalytics,
  getPendingMembers, approveJoinRequest, rejectJoinRequest,
  type PendingMember,
} from '@/services/manager.service'
import { getMessFeedbackSummary, getRecentFeedbackComments } from '@/services/messFeedback.service'
import { getStudentCount } from '@/services/student.service'
import { formatTime, formatDate, formatCurrency, getInitials, getAvatarColor, timeAgo } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'
import type { Database } from '@/types/database.types'

type ComplaintPriority = Database['public']['Enums']['complaint_priority']

const PRIORITY_ICON: Record<ComplaintPriority, React.ElementType> = {
  urgent: Flame,
  high:   AlertTriangle,
  medium: Clock,
  low:    CheckCircle2,
}

export default function ManagerDashboardPage() {
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const user       = useAuthStore((s) => s.user)
  const hostelId   = user?.profile.hostel_id ?? ''
  const isPg       = user?.hostel?.property_type === 'pg'

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['manager-stats', hostelId],
    queryFn:  () => getManagerStats(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 30_000,
  })

  const { data: mess, isLoading: messLoading } = useQuery({
    queryKey: ['mess-occupancy', hostelId],
    queryFn:  () => getMessOccupancy(hostelId),
    enabled:  !!hostelId,
    refetchInterval: 60_000,
  })

  const { data: feedbackSummary = [], isLoading: feedbackSummaryLoading } = useQuery({
    queryKey: ['mess-feedback-summary', hostelId],
    queryFn:  () => getMessFeedbackSummary(hostelId),
    enabled:  !!hostelId,
  })

  const { data: recentFeedback = [] } = useQuery({
    queryKey: ['mess-feedback-comments', hostelId],
    queryFn:  () => getRecentFeedbackComments(hostelId, 5),
    enabled:  !!hostelId,
  })

  const { data: gateMovements = [], isLoading: gateLoading } = useQuery({
    queryKey: ['live-gate', hostelId],
    queryFn:  () => getLiveGateMovements(hostelId),
    enabled:  !!hostelId && !isPg,
    refetchInterval: 15_000,
  })

  const { data: openComplaints = [], isLoading: complaintsLoading } = useQuery({
    queryKey: ['open-complaints', hostelId],
    queryFn:  () => getOpenComplaints(hostelId),
    enabled:  !!hostelId,
  })

  const { data: pendingPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['pending-payments', hostelId],
    queryFn:  () => getPendingPayments(hostelId, 5),
    enabled:  !!hostelId && isPg,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['manager-analytics', hostelId],
    queryFn:  () => getManagerAnalytics(hostelId),
    enabled:  !!hostelId,
  })

  const { data: pendingMembers = [], isLoading: pendingLoading } = useQuery({
    queryKey:       ['pending-members', hostelId],
    queryFn:        () => getPendingMembers(hostelId),
    enabled:        !!hostelId,
    refetchInterval: 30_000,
  })

  const { data: studentCount = 0 } = useQuery({
    queryKey: ['student-count', hostelId],
    queryFn:  () => getStudentCount(hostelId),
    enabled:  !!hostelId,
  })

  const { mutate: approveMember, isPending: approving } = useMutation({
    mutationFn: (userId: string) => approveJoinRequest(userId),
    onSuccess: () => {
      toast.success('Member approved')
      qc.invalidateQueries({ queryKey: ['pending-members', hostelId] })
      qc.invalidateQueries({ queryKey: ['manager-stats', hostelId] })
    },
    onError: () => toast.error('Failed to approve member'),
  })

  const { mutate: rejectMember, isPending: rejecting } = useMutation({
    mutationFn: (userId: string) => rejectJoinRequest(userId),
    onSuccess: () => {
      toast.success('Request rejected')
      qc.invalidateQueries({ queryKey: ['pending-members', hostelId] })
    },
    onError: () => toast.error('Failed to reject request'),
  })

  const { mutate: resolveComplaint, isPending: resolving } = useMutation({
    mutationFn: (id: string) => updateComplaintStatus(id, 'resolved', 'Resolved by warden'),
    onSuccess: () => {
      toast.success('Complaint marked as resolved')
      qc.invalidateQueries({ queryKey: ['open-complaints', hostelId] })
      qc.invalidateQueries({ queryKey: ['manager-stats', hostelId] })
    },
    onError: () => toast.error('Failed to update complaint'),
  })

  const hostelName = user?.hostel?.name ?? 'Ashiyaan'

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
            <p className="text-[16px] font-bold text-primary leading-tight">{hostelName} Warden</p>
            <p className="text-[12px] text-text-tertiary leading-tight capitalize">{user?.profile.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isPg && (
            <button
              onClick={() => navigate('/scan')}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-btn text-[13px] font-semibold active:scale-95 transition-transform"
            >
              <ScanLine size={15} /> Scan Pass
            </button>
          )}
          <button
            onClick={() => navigate('/notifications')}
            className="p-2 rounded-full hover:bg-surface-raised"
            aria-label="Notifications"
          >
            <Bell size={22} className="text-text-secondary" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* ── Pending Members ── hidden when empty */}
        {(pendingLoading || pendingMembers.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={18} className="text-warning" />
              <p className="text-[17px] font-bold text-text-primary">Pending Members</p>
              {!pendingLoading && (
                <span className="ml-auto text-[12px] font-semibold bg-warning-light text-warning px-2 py-0.5 rounded-pill">
                  {pendingMembers.length}
                </span>
              )}
            </div>

            {pendingLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface rounded-card shadow-card p-3 flex gap-3">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface rounded-card shadow-card overflow-hidden">
                {pendingMembers.map((member: PendingMember, idx: number) => (
                  <div key={member.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(member.full_name) }}
                      >
                        {getInitials(member.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">{member.full_name}</p>
                        <p className="text-[12px] text-text-tertiary">Waiting · {timeAgo(member.created_at)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => rejectMember(member.id)}
                          disabled={rejecting || approving}
                          className="px-3 py-1.5 border border-border rounded-btn text-[12px] font-semibold text-danger hover:bg-danger-light transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => approveMember(member.id)}
                          disabled={approving || rejecting}
                          className="px-3 py-1.5 bg-primary rounded-btn text-[12px] font-semibold text-white active:scale-95 transition-transform disabled:opacity-50"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Students ── */}
        <button
          onClick={() => navigate('/manager/students')}
          className="w-full bg-surface rounded-card shadow-card px-4 py-3.5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
              <Users size={16} />
            </span>
            <div className="text-left">
              <p className="text-[14px] font-semibold text-text-primary">Students</p>
              <p className="text-[12px] text-text-tertiary">{studentCount} active resident{studentCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
        </button>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 gap-3">
          {isPg ? (
            <>
              <StatCard
                label="Active Complaints"
                value={stats?.activeComplaints ?? 0}
                sub="Open tickets"
                icon={<AlertTriangle size={18} className="text-warning" />}
                valueColor="text-warning"
                loading={statsLoading}
              />
              <StatCard
                label="Pending Dues"
                value={stats?.pendingDues ?? 0}
                sub="Awaiting payment"
                icon={<IndianRupee size={18} className="text-danger" />}
                valueColor="text-danger"
                loading={statsLoading}
              />
            </>
          ) : (
            <>
              <StatCard
                label="Total Checked Out"
                value={stats?.checkedOut ?? 0}
                sub="Students"
                icon={<LogOut size={18} className="text-danger" />}
                loading={statsLoading}
              />
              <StatCard
                label="Active Complaints"
                value={stats?.activeComplaints ?? 0}
                sub="Open tickets"
                icon={<AlertTriangle size={18} className="text-warning" />}
                valueColor="text-warning"
                loading={statsLoading}
              />
            </>
          )}
        </div>

        {/* ── Quick Links ── */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Post Notice',    path: '/community',        icon: '📢' },
            { label: 'Edit Menu',      path: '/mess/menu-editor', icon: '🍽️' },
            { label: 'Payments',       path: '/manager/payments', icon: '💳' },
            { label: 'Leave Requests', path: '/manager/leave',    icon: '🗓️' },
          ].map(({ label, path, icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="bg-surface-raised rounded-card px-3 py-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-[11px] font-semibold text-text-secondary text-center">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Analytics ── */}
        <div className="bg-surface rounded-card shadow-card p-4">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            This Month
          </p>
          <div className="grid grid-cols-3 gap-3">
            <AnalyticsStat
              icon={<Building2 size={16} className="text-primary" />}
              label="Occupancy"
              value={analyticsLoading ? null : analytics?.occupancy ? `${analytics.occupancy.rate}%` : '—'}
              sub={analytics?.occupancy ? `${analytics.occupancy.occupied}/${analytics.occupancy.total} rooms` : 'No room data'}
            />
            <AnalyticsStat
              icon={<TrendingUp size={16} className="text-success" />}
              label="Collected"
              value={analyticsLoading ? null : analytics?.collection ? `${analytics.collection.rate}%` : '—'}
              sub={analytics?.collection ? formatCurrency(analytics.collection.collected) : 'No dues yet'}
            />
            <AnalyticsStat
              icon={<Timer size={16} className="text-info" />}
              label="Avg Resolve"
              value={analyticsLoading ? null : formatResolutionTime(analytics?.avgResolutionHours ?? null)}
              sub="Last 20 tickets"
            />
          </div>
        </div>

        {/* ── Mess Occupancy ── */}
        <div className="bg-surface rounded-card shadow-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
              Mess Occupancy
            </p>
            <UtensilsCrossed size={18} className="text-text-tertiary" />
          </div>
          {messLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <>
              <p className="text-[32px] font-bold text-text-primary leading-tight">
                {mess?.expected ?? 0}
              </p>
              <p className="text-[13px] text-text-secondary">
                Expected for dinner tonight{mess?.total ? ` · ${mess.total} total` : ''}
              </p>
            </>
          )}
        </div>

        {/* ── Mess Ratings ── */}
        <div className="bg-surface rounded-card shadow-card p-4">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-3">
            Mess Ratings · Last 7 Days
          </p>
          {feedbackSummaryLoading ? (
            <Skeleton className="h-12" />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {feedbackSummary.map(({ mealType, avgRating, count }) => (
                <div key={mealType} className="text-center">
                  <p className="text-[12px] font-semibold text-text-secondary capitalize mb-1">{mealType}</p>
                  {count > 0 ? (
                    <>
                      <StarRating value={avgRating} size={14} className="justify-center" />
                      <p className="text-[11px] text-text-tertiary mt-1">{avgRating.toFixed(1)} ({count})</p>
                    </>
                  ) : (
                    <p className="text-[12px] text-text-tertiary">No ratings</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {recentFeedback.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border space-y-2.5">
              {recentFeedback.map((f) => (
                <div key={f.id}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-text-primary truncate">
                      {f.profiles?.full_name ?? 'Resident'} · Room {f.profiles?.room_number ?? '—'}
                    </span>
                    <StarRating value={f.rating} size={11} className="flex-shrink-0" />
                  </div>
                  <p className="text-[12px] text-text-secondary line-clamp-2">{f.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Open Complaints ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[17px] font-bold text-text-primary">Pending Complaints</p>
            <button
              onClick={() => navigate('/complaints')}
              className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          {complaintsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-surface rounded-card shadow-card p-4">
                  <Skeleton lines={3} />
                </div>
              ))}
            </div>
          ) : openComplaints.length === 0 ? (
            <div className="bg-success-light rounded-card p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-success flex-shrink-0" />
              <p className="text-[14px] font-semibold text-success">All complaints resolved!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openComplaints.map((c) => {
                const profile  = (c as unknown as { profiles: { full_name: string; room_number: string | null } }).profiles
                const PriIcon  = PRIORITY_ICON[c.priority] ?? Clock
                return (
                  <div key={c.id} className="bg-surface rounded-card shadow-card p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[15px] font-bold text-text-primary">{c.title}</p>
                          <Badge variant={c.status}>{c.status.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-[12px] text-text-tertiary mt-0.5">
                          {profile?.full_name} · Room {profile?.room_number ?? '—'} · {timeAgo(c.created_at)}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-inner text-[11px] font-semibold ${
                        c.priority === 'urgent' ? 'bg-danger-light text-danger' :
                        c.priority === 'high'   ? 'bg-warning-light text-warning' :
                                                   'bg-surface-raised text-text-secondary'
                      }`}>
                        <PriIcon size={11} />
                        {c.priority}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[13px] text-text-secondary line-clamp-2">{c.description}</p>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => navigate(`/complaints/${c.id}`)}
                        className="flex-1 py-2 border border-border rounded-btn text-[13px] font-semibold text-text-secondary hover:bg-surface-raised transition-colors"
                      >
                        View Detail
                      </button>
                      <button
                        disabled={resolving}
                        onClick={() => resolveComplaint(c.id)}
                        className="flex-1 py-2 bg-primary rounded-btn text-[13px] font-semibold text-white active:scale-[0.97] transition-transform disabled:opacity-50"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Live Gate Movement (hostel/shared only — PG has no gate infra) ── */}
        {!isPg && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-bold text-text-primary">Live Gate Movement</p>
              <button
                onClick={() => navigate('/gate-pass/history')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            {gateLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface rounded-card shadow-card p-3 flex gap-3">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : gateMovements.length === 0 ? (
              <div className="bg-surface rounded-card shadow-card p-4 text-center">
                <p className="text-[13px] text-text-tertiary">No gate movements today</p>
              </div>
            ) : (
              <div className="bg-surface rounded-card shadow-card overflow-hidden">
                {gateMovements.map((pass, idx) => {
                  const profile = (pass as unknown as { profiles: { full_name: string; avatar_url: string | null; room_number: string | null } }).profiles
                  const name    = profile?.full_name ?? 'Unknown'
                  const room    = profile?.room_number
                  const initials = getInitials(name)
                  const color    = getAvatarColor(name)
                  const isExit   = pass.pass_type === 'exit'
                  const time     = pass.scanned_at ?? pass.generated_at

                  return (
                    <div key={pass.id}>
                      {idx > 0 && <div className="h-px bg-border mx-4" />}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-text-primary">{name}</p>
                          <p className="text-[12px] text-text-tertiary">
                            {room ? `Room ${room}` : 'No room assigned'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isExit ? 'bg-danger' : 'bg-success'}`} />
                            <span className={`text-[12px] font-bold ${isExit ? 'text-danger' : 'text-success'}`}>
                              {isExit ? 'Out' : 'In'}
                            </span>
                          </div>
                          <span className="text-[11px] text-text-tertiary">{formatTime(time)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Footer widget: Pending Payments (PG) / Today's Gate Activity (hostel) ── */}
        {isPg ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[17px] font-bold text-text-primary">Pending Payments</p>
              <button
                onClick={() => navigate('/manager/payments')}
                className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            {paymentsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-surface rounded-card shadow-card p-3 flex gap-3">
                    <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1"><Skeleton lines={2} /></div>
                  </div>
                ))}
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="bg-success-light rounded-card p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-success flex-shrink-0" />
                <p className="text-[14px] font-semibold text-success">All dues collected!</p>
              </div>
            ) : (
              <div className="bg-surface rounded-card shadow-card overflow-hidden">
                {pendingPayments.map((p, idx) => {
                  const profile = (p as unknown as { profiles: { full_name: string; room_number: string | null } }).profiles
                  const name    = profile?.full_name ?? 'Unknown'
                  const room    = profile?.room_number

                  return (
                    <div key={p.id}>
                      {idx > 0 && <div className="h-px bg-border mx-4" />}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(name) }}
                        >
                          {getInitials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-text-primary">{name}</p>
                          <p className="text-[12px] text-text-tertiary">
                            {room ? `Room ${room}` : 'No room'} · Due {p.due_date ? formatDate(p.due_date) : '—'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <p className="text-[14px] font-bold text-text-primary">{formatCurrency(p.amount)}</p>
                          <Badge variant={p.status}>{p.status}</Badge>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-primary-light rounded-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-primary" />
              <div>
                <p className="text-[14px] font-semibold text-text-primary">Today's Gate Activity</p>
                <p className="text-[12px] text-text-secondary">
                  {statsLoading ? '—' : `${stats?.todayMovements ?? 0} total movements`}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/gate-pass/history')}
              className="text-[13px] text-primary font-semibold"
            >
              View Log
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Resolution time formatting ──────────────────────────────────

function formatResolutionTime(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

// ── Analytics Stat ────────────────────────────────────────────

function AnalyticsStat({
  icon, label, value, sub,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  sub: string
}) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide truncate">{label}</p>
      </div>
      {value === null
        ? <Skeleton className="h-6 w-12" />
        : <p className="text-[20px] font-bold text-text-primary leading-tight">{value}</p>}
      <p className="text-[11px] text-text-tertiary leading-tight truncate">{sub}</p>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, valueColor = 'text-text-primary', loading,
}: {
  label: string
  value: number
  sub: string
  icon: React.ReactNode
  valueColor?: string
  loading?: boolean
}) {
  return (
    <div className="bg-surface rounded-card shadow-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide leading-tight">{label}</p>
        {icon}
      </div>
      {loading
        ? <Skeleton className="h-9 w-16" />
        : <p className={`text-[32px] font-bold leading-tight ${valueColor}`}>{String(value).padStart(2, '0')}</p>}
      <p className="text-[12px] text-text-secondary">{sub}</p>
    </div>
  )
}
