import { supabase } from '@/lib/supabase'

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
