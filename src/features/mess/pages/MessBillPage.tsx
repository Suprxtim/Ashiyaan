import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Coffee, UtensilsCrossed, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getMonthOptouts, getActiveMessRate } from '@/services/mess.service'
import { TopBar } from '@/components/layout/TopBar'
import { formatCurrency, formatDate } from '@/lib/utils'

const MEAL_ICONS = {
  breakfast: Coffee,
  lunch:     UtensilsCrossed,
  dinner:    Moon,
}

export default function MessBillPage() {
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: optouts = [], isLoading: optoutsLoading } = useQuery({
    queryKey: ['month-optouts', userId, year, month],
    queryFn:  () => getMonthOptouts(userId, year, month),
    enabled:  !!userId,
  })

  const { data: rate, isLoading: rateLoading } = useQuery({
    queryKey: ['mess-rate', hostelId],
    queryFn:  () => getActiveMessRate(hostelId),
    enabled:  !!hostelId,
  })

  const loading = optoutsLoading || rateLoading

  const { rows, totalCharged, totalSaved } = useMemo(() => {
    if (!rate) return { rows: [], totalCharged: 0, totalSaved: 0 }

    const optoutMap: Record<string, { breakfast: boolean; lunch: boolean; dinner: boolean }> = {}
    for (const o of optouts) optoutMap[o.date] = o

    // Build rows for every day of the month
    const daysInMonth = new Date(year, month, 0).getDate()
    const rows = []
    let totalCharged = 0
    let totalSaved = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const date  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const state = optoutMap[date] ?? { breakfast: true, lunch: true, dinner: true }
      const charge =
        (state.breakfast ? rate.breakfast_rate : 0) +
        (state.lunch     ? rate.lunch_rate     : 0) +
        (state.dinner    ? rate.dinner_rate    : 0)
      const saved =
        (!state.breakfast ? rate.breakfast_rate : 0) +
        (!state.lunch     ? rate.lunch_rate     : 0) +
        (!state.dinner    ? rate.dinner_rate    : 0)

      totalCharged += charge
      totalSaved   += saved

      // Only include days in current month up to today
      if (new Date(date) <= now) {
        rows.push({ date, state, charge })
      }
    }

    return { rows, totalCharged, totalSaved }
  }, [optouts, rate, year, month, now])

  const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Mess Bill" showBack />

      <div className="px-4 pt-16 space-y-5">

        {/* ── Summary Card ── */}
        <div className="bg-primary rounded-card p-5 text-white shadow-raised">
          <p className="text-white/70 text-[13px] uppercase tracking-wide">{monthName} Bill</p>
          {loading
            ? <div className="skeleton h-9 w-32 mt-2 rounded" />
            : <p className="text-[32px] font-bold mt-1">{formatCurrency(totalCharged)}</p>}
          <div className="flex gap-4 mt-3">
            <div>
              <p className="text-white/60 text-[11px]">Total Saved</p>
              <p className="text-accent text-[15px] font-bold">{formatCurrency(totalSaved)}</p>
            </div>
            <div>
              <p className="text-white/60 text-[11px]">Rate / Day</p>
              <p className="text-white text-[15px] font-bold">
                {rate ? formatCurrency(rate.breakfast_rate + rate.lunch_rate + rate.dinner_rate) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Rate breakdown ── */}
        {rate && (
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            {(['breakfast', 'lunch', 'dinner'] as const).map((meal, idx) => {
              const Icon = MEAL_ICONS[meal]
              const rateVal = meal === 'breakfast' ? rate.breakfast_rate : meal === 'lunch' ? rate.lunch_rate : rate.dinner_rate
              return (
                <div key={meal}>
                  {idx > 0 && <div className="h-px bg-border mx-4" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-inner bg-primary-light flex items-center justify-center flex-shrink-0">
                      <Icon size={15} className="text-primary" />
                    </div>
                    <p className="flex-1 text-[14px] font-medium text-text-primary capitalize">{meal}</p>
                    <p className="text-[14px] font-semibold text-text-primary">{formatCurrency(rateVal)}/day</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Day-by-day breakdown ── */}
        <div>
          <p className="text-[17px] font-bold text-text-primary mb-3">Daily Breakdown</p>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-14 rounded-card" />)}
            </div>
          ) : (
            <div className="bg-surface rounded-card shadow-card overflow-hidden">
              {rows.map(({ date, state, charge }, idx) => (
                <div key={date}>
                  {idx > 0 && <div className="h-px bg-border mx-4" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 flex-shrink-0">
                      <p className="text-[13px] font-bold text-text-primary">
                        {new Date(date).getDate()}
                      </p>
                      <p className="text-[10px] text-text-tertiary uppercase">
                        {formatDate(date, { weekday: 'short' })}
                      </p>
                    </div>

                    {/* Meal indicators */}
                    <div className="flex gap-1.5 flex-1">
                      {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => {
                        const on   = state[meal]
                        const Icon = MEAL_ICONS[meal]
                        return (
                          <div
                            key={meal}
                            className={`w-7 h-7 rounded-sm flex items-center justify-center ${
                              on ? 'bg-primary-light' : 'bg-danger-light'
                            }`}
                          >
                            <Icon size={12} className={on ? 'text-primary' : 'text-danger'} />
                          </div>
                        )
                      })}
                    </div>

                    <p className={`text-[14px] font-bold flex-shrink-0 ${charge === 0 ? 'text-success' : 'text-text-primary'}`}>
                      {charge === 0 ? 'Free' : formatCurrency(charge)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
