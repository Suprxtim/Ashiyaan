import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type LeaveStatus = Database['public']['Enums']['leave_status']
export type LeaveRequest = Database['public']['Tables']['leave_requests']['Row']

export type LeaveRequestWithProfile = LeaveRequest & {
  profiles: { full_name: string; room_number: string | null; avatar_url: string | null } | null
}

export async function getLeaveRequests(userId: string, status?: LeaveStatus): Promise<LeaveRequest[]> {
  let q = supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  const { data } = await q
  return data ?? []
}

export interface NewLeaveRequest {
  hostelId:    string
  userId:      string
  reason:      string
  destination: string | null
  fromDate:    string
  toDate:      string
}

export async function createLeaveRequest(payload: NewLeaveRequest) {
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      hostel_id:   payload.hostelId,
      user_id:     payload.userId,
      reason:      payload.reason,
      destination: payload.destination,
      from_date:   payload.fromDate,
      to_date:     payload.toDate,
      status:      'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelLeaveRequest(id: string, userId: string) {
  const { error } = await supabase
    .from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getAllHostelLeaveRequests(hostelId: string, status?: LeaveStatus): Promise<LeaveRequestWithProfile[]> {
  let q = supabase
    .from('leave_requests')
    .select('*, profiles!leave_requests_user_id_fkey(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  const { data } = await q
  return (data ?? []) as unknown as LeaveRequestWithProfile[]
}

export async function updateLeaveRequestStatus(
  id: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  reviewNote?: string,
) {
  const { error } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    })
    .eq('id', id)
  if (error) throw error
}
