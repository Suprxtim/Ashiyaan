import { supabase } from '@/lib/supabase'
import type { GateTrip, Profile } from '@/types/app.types'

export type TripScanResult = {
  trip_id: string
  student_name: string
  room_number: string | null
  destination: string
  purpose: string | null
  expected_return_at: string
  exit_at: string
  linked_leave_id: string | null
  duration_minutes: number | null
}

export type GateTripWithProfile = GateTrip & {
  profiles: {
    full_name: string
    room_number: string | null
    avatar_url: string | null
    phone: string | null
    parent_phone: string | null
  } | null
}

export function isOverdueTrip(trip: GateTripWithProfile): boolean {
  if (trip.status === 'overdue') return true
  if (trip.expected_return_at && new Date(trip.expected_return_at) < new Date()) return true
  return false
}

// ── Student functions ─────────────────────────────────────────

export async function getActiveTripForStudent(userId: string): Promise<GateTrip | null> {
  const { data } = await supabase
    .from('gate_trips')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'out', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getMyTrips(userId: string, limit = 20): Promise<GateTrip[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function createTrip(params: {
  userId: string
  hostelId: string
  destination: string
  purpose?: string
  expectedReturnAt: string
}): Promise<GateTrip> {
  const { data, error } = await supabase
    .from('gate_trips')
    .insert({
      user_id:            params.userId,
      hostel_id:          params.hostelId,
      destination:        params.destination,
      purpose:            params.purpose ?? null,
      expected_return_at: params.expectedReturnAt,
      status:             'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('gate_trips')
    .update({ status: 'cancelled' })
    .eq('id', tripId)
    .eq('status', 'pending')
  if (error) throw error
}

// ── Scanner / guard functions ─────────────────────────────────

export async function getStudentByQrToken(
  token: string,
): Promise<{ student: Profile; activeTrip: GateTrip | null } | null> {
  const { data: student, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('qr_identity_token', token)
    .maybeSingle()

  if (error || !student) return null

  const { data: trip } = await supabase
    .from('gate_trips')
    .select('*')
    .eq('user_id', student.id)
    .in('status', ['pending', 'out', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { student: student as Profile, activeTrip: trip }
}

export async function useTripExit(
  qrToken: string,
  guardNotes?: string,
): Promise<TripScanResult> {
  const { data, error } = await supabase.rpc('use_trip_exit', {
    p_qr_token:    qrToken,
    p_guard_notes: guardNotes,
  })
  if (error) throw error
  return data as TripScanResult
}

export async function useTripReturn(
  qrToken: string,
  guardNotes?: string,
): Promise<TripScanResult> {
  const { data, error } = await supabase.rpc('use_trip_return', {
    p_qr_token:    qrToken,
    p_guard_notes: guardNotes,
  })
  if (error) throw error
  return data as TripScanResult
}

export async function guardCreateTrip(params: {
  userId: string
  destination: string
  expectedReturnAt: string
  purpose?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('guard_create_trip', {
    p_user_id:            params.userId,
    p_destination:        params.destination,
    p_expected_return_at: params.expectedReturnAt,
    p_purpose:            params.purpose,
  })
  if (error) throw error
  return data as string
}

// ── Manager / warden functions ────────────────────────────────

export async function getTripsCurrentlyOut(hostelId: string): Promise<GateTripWithProfile[]> {
  const { data } = await supabase
    .from('gate_trips')
    .select('*, profiles!user_id(full_name, room_number, avatar_url, phone, parent_phone)')
    .eq('hostel_id', hostelId)
    .in('status', ['out', 'overdue'])
    .order('exit_at', { ascending: false })
  return (data ?? []) as GateTripWithProfile[]
}

export async function markTripReturnedByManager(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('gate_trips')
    .update({ status: 'returned', return_at: new Date().toISOString() })
    .eq('id', tripId)
  if (error) throw error
}

export async function getTodaysTripLog(hostelId: string): Promise<GateTripWithProfile[]> {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
  const { data } = await supabase
    .from('gate_trips')
    .select('*, profiles!user_id(full_name, room_number, avatar_url)')
    .eq('hostel_id', hostelId)
    .gte('exit_at', today)
    .not('exit_at', 'is', null)
    .order('exit_at', { ascending: false })
  return (data ?? []) as GateTripWithProfile[]
}
