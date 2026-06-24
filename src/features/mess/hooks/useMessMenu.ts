import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getWeekMenu, getWeekOptouts, upsertOptout, getActiveMessRate, getMonthOptouts, getMessSettings } from '@/services/mess.service'

function getWeekDates(offsetWeeks = 0) {
  const today = new Date()
  today.setDate(today.getDate() + offsetWeeks * 7)
  const day   = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export function useMessMenu() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const [weekOffset, setWeekOffset]   = useState(0)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const startDate = weekDates[0]
  const endDate   = weekDates[6]

  const { data: menu = [] } = useQuery({
    queryKey: ['mess-menu', hostelId, startDate],
    queryFn:  () => getWeekMenu(hostelId, startDate, endDate),
    enabled:  !!hostelId,
  })

  const { data: optouts = [] } = useQuery({
    queryKey: ['mess-optouts', userId, startDate],
    queryFn:  () => getWeekOptouts(userId, startDate, endDate),
    enabled:  !!userId,
  })

  const { data: rate } = useQuery({
    queryKey: ['mess-rate', hostelId],
    queryFn:  () => getActiveMessRate(hostelId),
    enabled:  !!hostelId,
  })

  const { data: settings = [] } = useQuery({
    queryKey: ['mess-settings', hostelId],
    queryFn:  () => getMessSettings(hostelId),
    enabled:  !!hostelId,
    staleTime: Infinity,
  })

  // Monthly optouts — separate query so the savings banner always shows the full month
  const now = new Date()
  const { data: monthOptouts = [] } = useQuery({
    queryKey: ['mess-optouts-month', userId, now.getFullYear(), now.getMonth() + 1],
    queryFn:  () => getMonthOptouts(userId, now.getFullYear(), now.getMonth() + 1),
    enabled:  !!userId,
  })

  // Build optout map: date → { breakfast, lunch, dinner }
  const optoutMap = useMemo(() => {
    const map: Record<string, { breakfast: boolean; lunch: boolean; dinner: boolean }> = {}
    for (const o of optouts) {
      map[o.date] = { breakfast: o.breakfast, lunch: o.lunch, dinner: o.dinner }
    }
    return map
  }, [optouts])

  // Get optout for a date (default all true = opted IN)
  function getMealState(date: string) {
    return optoutMap[date] ?? { breakfast: true, lunch: true, dinner: true }
  }

  // Savings and count both use the monthly dataset so the figures match
  const savedThisMonth = useMemo(() => {
    let savings = 0
    for (const o of monthOptouts) {
      if (!o.breakfast && rate) savings += rate.breakfast_rate
      if (!o.lunch    && rate) savings += rate.lunch_rate
      if (!o.dinner   && rate) savings += rate.dinner_rate
    }
    return savings
  }, [monthOptouts, rate])

  const optedOutMealsCount = useMemo(() => {
    return monthOptouts.reduce((acc, o) => {
      if (!o.breakfast) acc++
      if (!o.lunch)     acc++
      if (!o.dinner)    acc++
      return acc
    }, 0)
  }, [monthOptouts])

  const todayStr = new Date().toLocaleDateString('en-CA')

  function isCutoffPassed(date: string, meal: 'breakfast' | 'lunch' | 'dinner'): boolean {
    if (date !== todayStr) return false
    const s = settings.find((s) => s.meal_type === meal)
    if (!s) return false
    const now     = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const [h, m]  = s.cutoff_time.split(':').map(Number)
    return nowMins >= h * 60 + m
  }

  // Track which specific meal is in flight so siblings stay interactive
  const [togglingMealKey, setTogglingMealKey] = useState<string | null>(null)

  const { mutate: _toggleMeal } = useMutation({
    mutationFn: async ({ date, meal, value }: { date: string; meal: 'breakfast' | 'lunch' | 'dinner'; value: boolean }) => {
      const current = getMealState(date)
      return upsertOptout(
        userId, hostelId, date,
        meal === 'breakfast' ? value : current.breakfast,
        meal === 'lunch'     ? value : current.lunch,
        meal === 'dinner'    ? value : current.dinner,
      )
    },
    onSuccess: () => {
      setTogglingMealKey(null)
      qc.invalidateQueries({ queryKey: ['mess-optouts', userId, startDate] })
      qc.invalidateQueries({ queryKey: ['mess-optouts-month', userId, now.getFullYear(), now.getMonth() + 1] })
    },
    onError: (err: Error) => {
      setTogglingMealKey(null)
      toast.error(`Failed to update: ${err.message}`)
    },
  })

  function toggleMeal(args: { date: string; meal: 'breakfast' | 'lunch' | 'dinner'; value: boolean }) {
    setTogglingMealKey(`${args.date}-${args.meal}`)
    _toggleMeal(args)
  }

  // Get menu items for a date + meal
  function getMenuItems(date: string, mealType: string) {
    return menu.find((m) => m.date === date && m.meal_type === mealType)?.items ?? []
  }

  return {
    weekDates,
    weekOffset,
    setWeekOffset,
    selectedDate,
    setSelectedDate,
    getMealState,
    getMenuItems,
    toggleMeal,
    togglingMealKey,
    rate,
    savedThisMonth,
    optedOutMealsCount,
    settings,
    isCutoffPassed,
  }
}
