import { LogIn, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useGatePass } from '../hooks/useGatePass'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatTime } from '@/lib/utils'

export default function PassHistoryPage() {
  const user = useAuthStore((s) => s.user)
  const { history, historyLoading } = useGatePass()

  // Group by date
  const grouped = history.reduce<Record<string, typeof history>>((acc, pass) => {
    const date = formatDate(pass.generated_at, { weekday: 'long', day: 'numeric', month: 'short' })
    if (!acc[date]) acc[date] = []
    acc[date].push(pass)
    return acc
  }, {})

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Pass History" showBack />

      <div className="px-4 pt-16 space-y-5">
        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface rounded-card p-4 flex gap-3 shadow-card">
                <Skeleton circle className="w-10 h-10 flex-shrink-0" />
                <div className="flex-1"><Skeleton lines={2} /></div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon={<LogIn size={28} />}
            title="No pass history"
            description="Your entry and exit passes will appear here"
          />
        ) : (
          Object.entries(grouped).map(([date, passes]) => (
            <div key={date}>
              <p className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">
                {date}
              </p>
              <div className="space-y-2">
                {passes.map((pass) => (
                  <div key={pass.id} className="bg-surface rounded-card px-4 py-3 flex items-center gap-3 shadow-card">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      pass.pass_type === 'exit' ? 'bg-danger-light' : 'bg-success-light'
                    }`}>
                      {pass.pass_type === 'exit'
                        ? <LogOut size={18} className="text-danger" />
                        : <LogIn  size={18} className="text-success" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary capitalize">
                        Campus {pass.pass_type === 'exit' ? 'Exit' : 'Entry'}
                      </p>
                      <p className="text-[12px] text-text-tertiary">
                        {user?.profile.room_number && `Room ${user.profile.room_number} · `}
                        {formatTime(pass.generated_at)}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-pill flex-shrink-0 ${
                      pass.status === 'used'   ? 'bg-surface-raised text-text-tertiary' :
                      pass.status === 'active' ? 'bg-success-light text-success'        :
                                                  'bg-surface-raised text-text-tertiary'
                    }`}>
                      {pass.status.charAt(0).toUpperCase() + pass.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
