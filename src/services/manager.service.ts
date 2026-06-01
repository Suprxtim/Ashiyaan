import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
type ComplaintStatus = Database['public']['Enums']['complaint_status']

export async function getManagerStats(hostelId: string) {
  const today = new Date().toISOString().split('T')[0]

  const [checkedOut, activeComplaints, todayPasses] = await Promise.all([
    // Students currently outside (exit passes used today, no entry since)
    supabase
      .from('gate_passes')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .eq('pass_type', 'exit')
      .eq('status', 'used')
      .gte('scanned_at', today),

    // Open complaints
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .in('status', ['submitted', 'in_progress']),

    // Total gate movements today
    supabase
      .from('gate_passes')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .gte('generated_at', today),
  ])

  return {
    checkedOut:       checkedOut.count  ?? 0,
    activeComplaints: activeComplaints.count ?? 0,
    todayMovements:   todayPasses.count ?? 0,
  }
}

export async function getMessOccupancy(hostelId: string) {
  const today = new Date().toISOString().split('T')[0]

  // Count students who are opted IN for dinner tonight
  const { count: totalStudents } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('role', 'student')
    .eq('is_active', true)

  const { count: optedOut } = await supabase
    .from('mess_optouts')
    .select('id', { count: 'exact', head: true })
    .eq('hostel_id', hostelId)
    .eq('date', today)
    .eq('dinner', false)

  const total    = totalStudents ?? 0
  const expected = total - (optedOut ?? 0)

  return { expected, total }
}

export async function getLiveGateMovements(hostelId: string, limit = 10) {
  const { data } = await supabase
    .from('gate_passes')
    .select('*, profiles(full_name, avatar_url, room_number)')
    .eq('hostel_id', hostelId)
    .eq('status', 'used')
    .order('scanned_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

export async function getOpenComplaints(hostelId: string, limit = 5) {
  const { data } = await supabase
    .from('complaints')
    .select('*, profiles(full_name, room_number)')
    .eq('hostel_id', hostelId)
    .in('status', ['submitted', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  return data ?? []
}

export async function getPendingPayments(hostelId: string, limit = 5) {
  const { data } = await supabase
    .from('payments')
    .select('*, profiles(full_name, room_number)')
    .eq('hostel_id', hostelId)
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(limit)

  return data ?? []
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  note?: string,
) {
  const { error } = await supabase
    .from('complaints')
    .update({ status, resolution_note: note ?? null })
    .eq('id', id)
  if (error) throw error
}

export async function getAllHostelComplaints(hostelId: string, status?: ComplaintStatus) {
  let q = supabase
    .from('complaints')
    .select('*, profiles(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  const { data } = await q
  return data ?? []
}

export async function updateComplaintWithNote(
  id: string,
  newStatus: ComplaintStatus,
  note: string,
  updatedBy: string,
) {
  const { error: complaintErr } = await supabase
    .from('complaints')
    .update({
      status: newStatus,
      ...(newStatus === 'resolved' ? { resolution_note: note || null } : {}),
    })
    .eq('id', id)
  if (complaintErr) throw complaintErr

  const { error: updateErr } = await supabase
    .from('complaint_updates')
    .insert({
      complaint_id: id,
      new_status:   newStatus,
      note:         note || null,
      updated_by:   updatedBy,
    })
  if (updateErr) throw updateErr
}
