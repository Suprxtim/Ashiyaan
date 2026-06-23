import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
type ComplaintStatus = Database['public']['Enums']['complaint_status']

export type ComplaintWithProfile = Database['public']['Tables']['complaints']['Row'] & {
  profiles: { full_name: string; room_number: string | null; avatar_url: string | null } | null
}

export async function getManagerStats(hostelId: string) {
  const today = new Date().toISOString().split('T')[0]

  const [checkedOut, activeComplaints, todayPasses, pendingDues] = await Promise.all([
    // Students currently outside: trips with status 'out' or 'overdue'
    supabase
      .from('gate_trips')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .in('status', ['out', 'overdue']),

    // Open complaints
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .in('status', ['submitted', 'in_progress']),

    // Total gate movements today: trips where exit_at is today
    supabase
      .from('gate_trips')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .gte('exit_at', today)
      .not('exit_at', 'is', null),

    // Payments awaiting collection
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('hostel_id', hostelId)
      .in('status', ['pending', 'overdue']),
  ])

  return {
    checkedOut:       checkedOut.count  ?? 0,
    activeComplaints: activeComplaints.count ?? 0,
    todayMovements:   todayPasses.count ?? 0,
    pendingDues:      pendingDues.count ?? 0,
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

export type GateTripMovement = {
  id: string
  destination: string
  purpose: string | null
  exit_at: string | null
  return_at: string | null
  status: string
  profiles: { full_name: string; avatar_url: string | null; room_number: string | null } | null
}

export async function getLiveGateMovements(hostelId: string, limit = 10): Promise<GateTripMovement[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('id, destination, purpose, exit_at, return_at, status, profiles(full_name, avatar_url, room_number)')
    .eq('hostel_id', hostelId)
    .not('exit_at', 'is', null)
    .order('exit_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as GateTripMovement[]
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

export async function getAllHostelComplaints(hostelId: string, status?: ComplaintStatus): Promise<ComplaintWithProfile[]> {
  let q = supabase
    .from('complaints')
    .select('*, profiles(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  const { data } = await q
  return (data ?? []) as unknown as ComplaintWithProfile[]
}

export interface ManagerAnalytics {
  occupancy: { occupied: number; total: number; rate: number } | null
  collection: { collected: number; total: number; rate: number } | null
  avgResolutionHours: number | null
}

export async function getManagerAnalytics(hostelId: string): Promise<ManagerAnalytics> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [roomsRes, paymentsRes, complaintsRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('is_occupied')
      .eq('hostel_id', hostelId),

    supabase
      .from('payments')
      .select('amount, status')
      .eq('hostel_id', hostelId)
      .gte('created_at', monthStart.toISOString()),

    supabase
      .from('complaints')
      .select('created_at, resolved_at')
      .eq('hostel_id', hostelId)
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(20),
  ])

  const rooms = roomsRes.data ?? []
  const occupiedRooms = rooms.filter((r) => r.is_occupied).length
  const occupancy = rooms.length > 0
    ? { occupied: occupiedRooms, total: rooms.length, rate: Math.round((occupiedRooms / rooms.length) * 100) }
    : null

  const payments = paymentsRes.data ?? []
  const totalAmount     = payments.reduce((sum, p) => sum + p.amount, 0)
  const collectedAmount = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const collection = totalAmount > 0
    ? { collected: collectedAmount, total: totalAmount, rate: Math.round((collectedAmount / totalAmount) * 100) }
    : null

  const resolved = complaintsRes.data ?? []
  const avgResolutionHours = resolved.length > 0
    ? resolved.reduce((sum, c) => sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()) / 3_600_000, 0) / resolved.length
    : null

  return { occupancy, collection, avgResolutionHours }
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

export interface PendingMember {
  id: string
  full_name: string
  phone: string | null
  created_at: string
}

export async function getPendingMembers(hostelId: string): Promise<PendingMember[]> {
  const { data, error } = await supabase.rpc('get_pending_members', { p_hostel_id: hostelId })
  if (error) throw error
  return (data ?? []) as PendingMember[]
}

export async function approveJoinRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_join_request', { p_user_id: userId })
  if (error) throw error
}

export async function rejectJoinRequest(userId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_join_request', { p_user_id: userId })
  if (error) throw error
}
