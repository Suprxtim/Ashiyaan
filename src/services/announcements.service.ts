import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type AnnouncementCategory = Database['public']['Enums']['announcement_category']

export async function createAnnouncement(payload: {
  hostelId:  string
  postedBy:  string
  title:     string
  content:   string
  category:  AnnouncementCategory
  isPinned:  boolean
  expiresAt: string | null
}) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      hostel_id:  payload.hostelId,
      posted_by:  payload.postedBy,
      title:      payload.title,
      content:    payload.content,
      category:   payload.category,
      is_pinned:  payload.isPinned,
      expires_at: payload.expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

export async function togglePin(id: string, isPinned: boolean) {
  const { error } = await supabase
    .from('announcements')
    .update({ is_pinned: isPinned })
    .eq('id', id)
  if (error) throw error
}
