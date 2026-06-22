import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/app.types'

export type StudentListItem = Pick<Profile,
  'id' | 'full_name' | 'room_number' | 'course' | 'college_year' | 'phone' | 'avatar_url'
>

export async function getStudentCount(hostelId: string): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('role', 'student')
    .eq('is_active', true)
  if (error) throw error
  return count ?? 0
}

export async function getStudents(hostelId: string): Promise<StudentListItem[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, room_number, course, college_year, phone, avatar_url')
    .eq('hostel_id', hostelId)
    .eq('role', 'student')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as StudentListItem[]
}

export async function getStudentById(studentId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .eq('role', 'student')
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function assignRoom(userId: string, roomNumber: string): Promise<void> {
  const { error } = await supabase.rpc('assign_room', {
    p_user_id: userId,
    p_room_number: roomNumber,
  })
  if (error) throw error
}
