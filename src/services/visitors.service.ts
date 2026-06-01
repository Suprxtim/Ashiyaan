import { supabase } from '@/lib/supabase'

export async function getVisitors(userId: string) {
  const { data } = await supabase
    .from('visitors')
    .select('*')
    .eq('host_user_id', userId)
    .order('expected_date', { ascending: true })
  return data ?? []
}

export async function createVisitor(payload: {
  hostUserId:   string
  hostelId:     string
  visitorName:  string
  visitorPhone: string
  purpose:      string
  expectedDate: string
  expectedTime: string
}) {
  // Pass expires 24h after expected date
  const expiresAt = new Date(`${payload.expectedDate}T${payload.expectedTime || '23:59'}`)
  expiresAt.setHours(expiresAt.getHours() + 24)

  const { data, error } = await supabase
    .from('visitors')
    .insert({
      host_user_id:  payload.hostUserId,
      hostel_id:     payload.hostelId,
      visitor_name:  payload.visitorName,
      visitor_phone: payload.visitorPhone,
      purpose:       payload.purpose || null,
      expected_date: payload.expectedDate,
      expected_time: payload.expectedTime || null,
      pass_expiry:   expiresAt.toISOString(),
      status:        'approved',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelVisitor(id: string) {
  const { error } = await supabase
    .from('visitors')
    .update({ status: 'expired' })
    .eq('id', id)
  if (error) throw error
}
