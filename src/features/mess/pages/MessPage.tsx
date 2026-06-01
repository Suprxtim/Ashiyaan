import { useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, PiggyBank, Coffee, UtensilsCrossed, Moon, ChevronRight as ChevronR } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useMessMenu } from '../hooks/useMessMenu'
import { getInitials, getAvatarColor, formatCurrency } from '@/lib/utils'
import { Toggle } from '@/components/ui/Toggle'

const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const MEALS = [
  { key: 'breakfast' as const, label: 'Breakfast', time: '08:00 AM – 10:00 AM', Icon: Coffee },
  { key: 'lunch'     as const, label: 'Lunch',     time: '01:00 PM – 03:00 PM', Icon: UtensilsCrossed },
  { key: 'dinner'    as const, label: 'Dinner',    time: '08:00 PM – 10:00 PM', Icon: Moon },
]

export default function MessPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const {
    weekDates, setWeekOffset,
    selectedDate, setSelectedDate,
    getMealState, getMenuItems,
    toggleMeal, togglingMealKey,
    savedThisMonth, optedOutMealsCount,
  } = useMessMenu()

  const today        = new Date().toISOString().split('T')[0]
  const tomorrow     = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const tomorrowMenu = getMenuItems(tomorrow, 'dinner')

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'
  const hostelName  = user?.hostel?.name?.split(' ')[0] ?? 'Block'
  const roomLabel   = user?.profile.room_number
    ? `${hostelName} · Room ${user.profile.room_number}`
    : user?.hostel?.name ?? 'Ashiyaan'

  const selectedMeals = getMealState(selectedDate)
  const isPast = (date: string) => date < today

  // Show week range label e.g. "May 26 – Jun 1"
  const firstDate = new Date(weekDates[0])
  const lastDate  = new Date(weekDates[6])
  const weekLabel = `${MONTH_NAMES[firstDate.getMonth()]} ${firstDate.getDate()} – ${MONTH_NAMES[lastDate.getMonth()]} ${lastDate.getDate()}`

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

      <div className="pt-4 space-y-5">

        {/* ── Week Navigator ── */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-inner hover:bg-surface-raised transition-colors"
            >
              <ChevronLeft size={18} className="text-text-secondary" />
            </button>
            <p className="text-[13px] font-semibold text-text-secondary">{weekLabel}</p>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-inner hover:bg-surface-raised transition-colors"
            >
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
          </div>

          {/* Date strip */}
          <div className="flex gap-2 justify-between">
            {weekDates.map((date, i) => {
              const d       = new Date(date)
              const isToday = date === today
              const isSel   = date === selectedDate
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center flex-1 py-2.5 rounded-inner transition-colors ${
                    isSel
                      ? 'bg-primary text-white'
                      : isToday
                      ? 'bg-primary-light text-primary border border-primary'
                      : 'bg-surface text-text-secondary'
                  }`}
                >
                  <span className="text-[10px] font-medium uppercase">{DAY_LABELS[i]}</span>
                  <span className={`text-[16px] font-bold leading-tight mt-0.5 ${
                    isSel ? 'text-white' : isToday ? 'text-primary' : 'text-text-primary'
                  }`}>
                    {d.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Savings Banner ── */}
        {savedThisMonth > 0 && (
          <div className="mx-4 bg-accent-light rounded-card px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <PiggyBank size={18} className="text-text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-text-primary">
                You saved {formatCurrency(savedThisMonth)} this month
              </p>
              <p className="text-[12px] text-text-secondary">
                by opting out of {optedOutMealsCount} meal{optedOutMealsCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* ── Today's Attendance ── */}
        <div className="px-4">
          <p className="text-[17px] font-bold text-text-primary mb-3">
            {selectedDate === today ? "Today's Attendance" : 'Attendance'}
          </p>
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            {MEALS.map(({ key, label, time, Icon }, idx) => {
              const isOn       = selectedMeals[key]
              const isPastDate = isPast(selectedDate)
              const isBusy     = togglingMealKey === `${selectedDate}-${key}`
              return (
                <div key={key}>
                  {idx > 0 && <div className="h-px bg-border mx-4" />}
                  <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${!isOn ? 'bg-danger-light/30' : ''}`}>
                    <div className={`w-9 h-9 rounded-inner flex items-center justify-center flex-shrink-0 ${
                      isOn ? 'bg-primary-light' : 'bg-surface-raised'
                    }`}>
                      <Icon size={18} className={isOn ? 'text-primary' : 'text-text-tertiary'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary">{label}</p>
                      <p className="text-[12px] text-text-tertiary">{time}</p>
                    </div>
                    <Toggle
                      checked={isOn}
                      disabled={isPastDate || isBusy}
                      onChange={(val) => toggleMeal({ date: selectedDate, meal: key, value: val })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {isPast(selectedDate) && (
            <p className="text-[12px] text-text-tertiary mt-2 text-center">
              Cannot change past meal preferences
            </p>
          )}
        </div>

        {/* ── Tomorrow's Menu ── */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[17px] font-bold text-text-primary">Tomorrow's Menu</p>
            <button
              onClick={() => { setSelectedDate(tomorrow); setWeekOffset(0) }}
              className="text-[13px] text-primary font-semibold flex items-center gap-0.5"
            >
              View Full <ChevronR size={14} />
            </button>
          </div>

          {tomorrowMenu.length > 0 ? (
            <div className="bg-primary rounded-card overflow-hidden shadow-card">
              <div className="p-4">
                <span className="bg-accent text-text-primary text-[10px] font-bold px-2.5 py-1 rounded-pill uppercase">
                  Dinner Special
                </span>
                <p className="text-white text-[16px] font-bold mt-2 leading-snug">
                  {tomorrowMenu[0]}
                </p>
                <p className="text-white/70 text-[13px] mt-1">
                  {tomorrowMenu.slice(1).join(' · ')}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-card shadow-card p-4">
              <p className="text-[13px] text-text-tertiary italic text-center">
                Menu not posted yet
              </p>
            </div>
          )}
        </div>

        {/* ── View Bill ── */}
        <div className="px-4">
          <button
            onClick={() => navigate('/mess/bill')}
            className="w-full bg-surface rounded-card shadow-card px-4 py-3.5 flex items-center justify-between"
          >
            <div>
              <p className="text-[14px] font-semibold text-text-primary">View Mess Bill</p>
              <p className="text-[12px] text-text-tertiary">This month's detailed breakdown</p>
            </div>
            <ChevronR size={18} className="text-text-tertiary flex-shrink-0" />
          </button>
        </div>

      </div>
    </div>
  )
}
