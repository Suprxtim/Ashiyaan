import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type MealType = Database['public']['Enums']['meal_type']
export type MessFeedback = Database['public']['Tables']['mess_feedback']['Row']

export type MessFeedbackWithProfile = MessFeedback & {
  profiles: { full_name: string; room_number: string | null } | null
}

export async function getFeedbackForDate(userId: string, date: string): Promise<MessFeedback[]> {
  const { data } = await supabase
    .from('mess_feedback')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
  return data ?? []
}

export interface MessFeedbackInput {
  userId:   string
  hostelId: string
  date:     string
  mealType: MealType
  rating:   number
  comment:  string | null
}

export async function upsertMessFeedback(payload: MessFeedbackInput) {
  const { data, error } = await supabase
    .from('mess_feedback')
    .upsert({
      user_id:   payload.userId,
      hostel_id: payload.hostelId,
      date:      payload.date,
      meal_type: payload.mealType,
      rating:    payload.rating,
      comment:   payload.comment,
    }, { onConflict: 'user_id,date,meal_type' })
    .select()
    .single()
  if (error) throw error
  return data
}

export interface MessFeedbackSummary {
  mealType:  MealType
  avgRating: number
  count:     number
}

export async function getMessFeedbackSummary(hostelId: string, days = 7): Promise<MessFeedbackSummary[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const { data } = await supabase
    .from('mess_feedback')
    .select('meal_type, rating')
    .eq('hostel_id', hostelId)
    .gte('date', sinceStr)

  const rows = data ?? []
  const groups: Record<MealType, { sum: number; count: number }> = {
    breakfast: { sum: 0, count: 0 },
    lunch:     { sum: 0, count: 0 },
    dinner:    { sum: 0, count: 0 },
  }
  for (const r of rows) {
    groups[r.meal_type].sum   += r.rating
    groups[r.meal_type].count += 1
  }

  return (['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => ({
    mealType,
    avgRating: groups[mealType].count > 0 ? groups[mealType].sum / groups[mealType].count : 0,
    count:     groups[mealType].count,
  }))
}

export async function getRecentFeedbackComments(hostelId: string, limit = 5): Promise<MessFeedbackWithProfile[]> {
  const { data } = await supabase
    .from('mess_feedback')
    .select('*, profiles(full_name, room_number)')
    .eq('hostel_id', hostelId)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as MessFeedbackWithProfile[]
}
