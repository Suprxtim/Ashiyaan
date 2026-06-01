import { supabase } from '@/lib/supabase'

export async function getPayments(userId: string) {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true })
  return data ?? []
}

export async function getPaymentSummary(userId: string) {
  const { data: pending } = await supabase
    .from('payments')
    .select('amount, due_date')
    .eq('user_id', userId)
    .in('status', ['pending', 'overdue'])

  const { data: lastPaid } = await supabase
    .from('payments')
    .select('amount, paid_date')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .order('paid_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const totalOutstanding = pending?.reduce((s, p) => s + p.amount, 0) ?? 0
  const nearestDue       = pending?.sort((a, b) =>
    new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime()
  )[0]?.due_date ?? null

  return { totalOutstanding, nearestDue, lastPaid: lastPaid ?? null }
}

export async function seedDemoPayments(userId: string, hostelId: string) {
  const now   = new Date()
  const month = now.toLocaleString('en-IN', { month: 'long' })
  const due   = new Date(now.getFullYear(), now.getMonth(), 15).toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existing && existing.length > 0) return

  await supabase.from('payments').insert([
    { user_id: userId, hostel_id: hostelId, payment_type: 'rent',        amount: 12000, due_date: due, status: 'pending', description: `Room Rent – ${month}` },
    { user_id: userId, hostel_id: hostelId, payment_type: 'mess',        amount: 2000,  due_date: due, status: 'pending', description: `Mess Charges – ${month}` },
    { user_id: userId, hostel_id: hostelId, payment_type: 'electricity', amount: 500,   due_date: due, status: 'pending', description: `Electricity Bill – ${month}` },
  ])
}
