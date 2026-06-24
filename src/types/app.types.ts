import type { Database } from './database.types'

export type UserRole     = Database['public']['Enums']['user_role']
export type PropertyType = Database['public']['Enums']['property_type']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Hostel = Database['public']['Tables']['hostels']['Row']
export type GatePass = Database['public']['Tables']['gate_passes']['Row']
export type GateTrip = Database['public']['Tables']['gate_trips']['Row']
export type MessOptout = Database['public']['Tables']['mess_optouts']['Row']
export type MessMenu = Database['public']['Tables']['mess_menu']['Row']
export type MessRate = Database['public']['Tables']['mess_rates']['Row']
export type MessSetting = Database['public']['Tables']['mess_settings']['Row']
export type Complaint = Database['public']['Tables']['complaints']['Row']
export type ComplaintUpdate = Database['public']['Tables']['complaint_updates']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Announcement = Database['public']['Tables']['announcements']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

export interface AuthUser {
  id: string
  email: string | undefined
  profile: Profile
  hostel: Hostel | null
}

export interface NavItem {
  label: string
  path: string
  icon: string
  roles?: UserRole[]
}

