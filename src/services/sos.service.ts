import { supabase } from '@/lib/supabase'

export async function getSosIncidents(hostelId: string) {
  // Two FKs from sos_incidents → profiles (user_id + acknowledged_by).
  // PostgREST requires the FK hint to resolve the join unambiguously.
  const { data, error } = await supabase
    .from('sos_incidents')
    .select('*, profiles!sos_incidents_user_id_fkey(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

export async function acknowledgeSosIncident(id: string, wardenId: string) {
  const { error } = await supabase
    .from('sos_incidents')
    .update({
      status:          'responded',
      acknowledged_by: wardenId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
