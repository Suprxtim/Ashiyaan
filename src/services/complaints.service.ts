import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type ComplaintStatus   = Database['public']['Enums']['complaint_status']
type ComplaintCategory = Database['public']['Enums']['complaint_category']
type ComplaintPriority = Database['public']['Enums']['complaint_priority']

export async function getComplaints(userId: string, status?: ComplaintStatus) {
  let q = supabase
    .from('complaints')
    .select('*, complaint_updates(id, new_status, note, created_at, updated_by)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  const { data } = await q
  return data ?? []
}

export async function getComplaintById(id: string) {
  const { data } = await supabase
    .from('complaints')
    .select('*, complaint_updates(*, profiles(full_name, avatar_url))')
    .eq('id', id)
    .single()
  return data
}

export interface NewComplaint {
  hostelId:    string
  userId:      string
  category:    ComplaintCategory
  title:       string
  description: string
  priority:    ComplaintPriority
  photos:      string[]
}

export async function createComplaint(payload: NewComplaint) {
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      hostel_id:   payload.hostelId,
      user_id:     payload.userId,
      category:    payload.category,
      title:       payload.title,
      description: payload.description,
      priority:    payload.priority,
      photos:      payload.photos,
      status:      'submitted',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadComplaintPhoto(file: File, userId: string): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `complaints/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('complaint-photos')
    .upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('complaint-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function rateComplaint(id: string, rating: number) {
  const { error } = await supabase
    .from('complaints')
    .update({ rating })
    .eq('id', id)
  if (error) throw error
}
