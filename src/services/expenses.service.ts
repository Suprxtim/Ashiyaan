import { supabase } from '@/lib/supabase'

export interface NewExpense {
  hostelId:    string
  createdBy:   string
  paidBy:      string
  title:       string
  description: string
  totalAmount: number
  category:    string
  date:        string
  splits:      { userId: string; amount: number }[]
}

export async function getExpenses(hostelId: string) {
  const { data } = await supabase
    .from('expenses')
    .select('*, profiles!expenses_paid_by_fkey(full_name, avatar_url), expense_splits(*, profiles(full_name))')
    .eq('hostel_id', hostelId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createExpense(payload: NewExpense) {
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      hostel_id:    payload.hostelId,
      created_by:  payload.createdBy,
      paid_by:     payload.paidBy,
      title:       payload.title,
      description: payload.description || null,
      total_amount: payload.totalAmount,
      category:    payload.category as 'other',
      date:        payload.date,
    })
    .select()
    .single()
  if (error) throw error

  // Insert splits
  if (payload.splits.length > 0) {
    const { error: splitErr } = await supabase
      .from('expense_splits')
      .insert(
        payload.splits.map((s) => ({
          expense_id: expense.id,
          user_id:    s.userId,
          amount:     s.amount,
        }))
      )
    if (splitErr) throw splitErr
  }

  return expense
}

export async function markSplitPaid(splitId: string) {
  const { error } = await supabase
    .from('expense_splits')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', splitId)
  if (error) throw error
}

export async function getBalances(hostelId: string, userId: string) {
  // What others owe me (I paid, they haven't settled)
  const { data: iOwedData } = await supabase
    .from('expense_splits')
    .select('amount, user_id, expenses!inner(paid_by, hostel_id, title)')
    .eq('expenses.hostel_id', hostelId)
    .eq('expenses.paid_by', userId)
    .neq('user_id', userId)
    .eq('is_paid', false)

  // What I owe others
  const { data: iOweData } = await supabase
    .from('expense_splits')
    .select('amount, expenses!inner(paid_by, hostel_id, title)')
    .eq('expenses.hostel_id', hostelId)
    .eq('user_id', userId)
    .neq('expenses.paid_by', userId)
    .eq('is_paid', false)

  const iAmOwed = (iOwedData ?? []).reduce((s, r) => s + r.amount, 0)
  const iOwe    = (iOweData  ?? []).reduce((s, r) => s + r.amount, 0)

  return { iAmOwed, iOwe, net: iAmOwed - iOwe }
}

export async function getHouseholdMembers(hostelId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, room_number')
    .eq('hostel_id', hostelId)
    .eq('is_active', true)
  return data ?? []
}
