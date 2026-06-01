import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type PassType = Database['public']['Enums']['pass_type']

export async function generatePass(userId: string, hostelId: string, passType: PassType) {
  // Expire any active passes first
  await supabase
    .from('gate_passes')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')

  const now      = new Date()
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes
  const token    = `${userId}-${now.getTime()}-${crypto.randomUUID()}`

  const { data, error } = await supabase
    .from('gate_passes')
    .insert({
      user_id:    userId,
      hostel_id:  hostelId,
      qr_token:   token,
      pass_type:  passType,
      status:     'active',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getActivePass(userId: string) {
  const { data } = await supabase
    .from('gate_passes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getPassHistory(userId: string, limit = 20) {
  const { data } = await supabase
    .from('gate_passes')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

export async function expirePass(passId: string) {
  await supabase
    .from('gate_passes')
    .update({ status: 'expired' })
    .eq('id', passId)
    .eq('status', 'active')
}
