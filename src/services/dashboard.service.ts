import { supabase } from '@/lib/supabase'

export async function fetchDashboardStats(userId: string, _hostelId: string) {
  const today = new Date().toISOString().split('T')[0]

  const [optoutRes, complaintsRes, paymentsRes] = await Promise.all([
    supabase
      .from('mess_optouts')
      .select('breakfast, lunch, dinner')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),

    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['submitted', 'in_progress']),

    supabase
      .from('payments')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ])

  // true = eating that meal (opted IN), false = skipping (opted OUT).
  // Count true values to get meals the student will have today.
  // No row means no changes from default → all 3 meals.
  const optout = optoutRes.data
  const mealsToday = optout
    ? [optout.breakfast, optout.lunch, optout.dinner].filter(Boolean).length
    : 3

  const openIssues = complaintsRes.count ?? 0

  const amountDue = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) ?? 0

  return { mealsToday, openIssues, amountDue }
}

export async function fetchAnnouncements(hostelId: string) {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('hostel_id', hostelId)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(6)

  return data ?? []
}

export type RecentTripActivity = {
  id: string
  destination: string
  exit_at: string
  status: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

export async function fetchRecentActivity(userId: string): Promise<RecentTripActivity[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('id, destination, exit_at, status, profiles(full_name, avatar_url)')
    .eq('user_id', userId)
    .not('exit_at', 'is', null)
    .order('exit_at', { ascending: false })
    .limit(5)

  return (data ?? []) as RecentTripActivity[]
}

export async function fetchRecentComplaints(userId: string) {
  const { data } = await supabase
    .from('complaints')
    .select('id, title, category, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(4)

  return data ?? []
}
