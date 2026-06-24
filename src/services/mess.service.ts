import { supabase } from '@/lib/supabase'
import type { MessSetting } from '@/types/app.types'

export type MealCounts = {
  breakfast: { total: number; optedOut: number; expected: number }
  lunch:     { total: number; optedOut: number; expected: number }
  dinner:    { total: number; optedOut: number; expected: number }
}

export async function getWeekMenu(hostelId: string, startDate: string, endDate: string) {
  const { data } = await supabase
    .from('mess_menu')
    .select('*')
    .eq('hostel_id', hostelId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  return data ?? []
}

export async function getWeekOptouts(userId: string, startDate: string, endDate: string) {
  const { data } = await supabase
    .from('mess_optouts')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
  return data ?? []
}

export async function upsertOptout(
  userId: string,
  hostelId: string,
  date: string,
  breakfast: boolean,
  lunch: boolean,
  dinner: boolean,
) {
  const { data, error } = await supabase
    .from('mess_optouts')
    .upsert(
      { user_id: userId, hostel_id: hostelId, date, breakfast, lunch, dinner },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMonthOptouts(userId: string, year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  // Use the real last day — PostgreSQL rejects invalid dates like "2024-02-31"
  const lastDay = new Date(year, month, 0).getDate()
  const end   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data } = await supabase
    .from('mess_optouts')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
  return data ?? []
}

export async function getActiveMessRate(hostelId: string) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('mess_rates')
    .select('*')
    .eq('hostel_id', hostelId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getMessSettings(hostelId: string): Promise<MessSetting[]> {
  const { data } = await supabase
    .from('mess_settings')
    .select('*')
    .eq('hostel_id', hostelId)
  return data ?? []
}

export async function upsertMessSetting(
  hostelId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  config: { enabled: boolean; start_time: string; end_time: string; cutoff_time: string },
): Promise<void> {
  const { error } = await supabase
    .from('mess_settings')
    .upsert(
      { hostel_id: hostelId, meal_type: mealType, ...config },
      { onConflict: 'hostel_id,meal_type' },
    )
  if (error) throw error
}

export async function getTodaysMealCounts(hostelId: string, date: string): Promise<MealCounts> {
  const [totalRes, optoutsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .eq('role', 'student')
      .eq('is_active', true),
    supabase
      .from('mess_optouts')
      .select('breakfast, lunch, dinner')
      .eq('hostel_id', hostelId)
      .eq('date', date),
  ])

  const total   = totalRes.count ?? 0
  const optouts = optoutsRes.data ?? []

  const bfOut     = optouts.filter((o) => !o.breakfast).length
  const lunchOut  = optouts.filter((o) => !o.lunch).length
  const dinnerOut = optouts.filter((o) => !o.dinner).length

  return {
    breakfast: { total, optedOut: bfOut,     expected: total - bfOut     },
    lunch:     { total, optedOut: lunchOut,  expected: total - lunchOut  },
    dinner:    { total, optedOut: dinnerOut, expected: total - dinnerOut },
  }
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'] as const

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function getCurrentMeal(
  settings: MessSetting[],
  now: Date,
): { meal: MessSetting; status: 'active' | 'next' } | null {
  const enabled = MEAL_ORDER
    .map((key) => settings.find((s) => s.meal_type === key))
    .filter((s): s is MessSetting => !!s && s.enabled)

  if (enabled.length === 0) return null

  const nowMins = now.getHours() * 60 + now.getMinutes()

  for (const meal of enabled) {
    if (nowMins >= toMins(meal.start_time) && nowMins < toMins(meal.end_time)) {
      return { meal, status: 'active' }
    }
  }

  for (const meal of enabled) {
    if (nowMins < toMins(meal.start_time)) {
      return { meal, status: 'next' }
    }
  }

  // All meals done for the calendar day — next meal is tomorrow's first
  return { meal: enabled[0], status: 'next' }
}
