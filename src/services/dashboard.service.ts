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

export async function fetchRecentActivity(userId: string) {
  const { data } = await supabase
    .from('gate_passes')
    .select('id, pass_type, status, generated_at, scanned_at')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(5)

  return data ?? []
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
