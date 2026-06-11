import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

export type RoomDetails = Database['public']['Tables']['rooms']['Row']

export type Roommate = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'phone' | 'role' | 'avatar_url'
>

export async function getRoomDetails(hostelId: string, roomNumber: string): Promise<RoomDetails | null> {
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('hostel_id', hostelId)
    .eq('room_number', roomNumber)
    .maybeSingle()

  return data
}

export async function getRoommates(hostelId: string, roomNumber: string, excludeUserId: string): Promise<Roommate[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, avatar_url')
    .eq('hostel_id', hostelId)
    .eq('room_number', roomNumber)
    .eq('is_active', true)
    .neq('id', excludeUserId)
    .order('full_name', { ascending: true })

  return data ?? []
}
