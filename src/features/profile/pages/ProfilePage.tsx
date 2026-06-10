import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Hash, Building2, LogOut, ChevronRight, Shield, Bell, HelpCircle, Info, Home, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { TopBar } from '@/components/layout/TopBar'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getInitials, getAvatarColor } from '@/lib/utils'

const PROP_TYPE_CONFIG = {
  hostel: { label: 'Hostel',           color: 'bg-primary-light text-primary', Icon: Building2 },
  pg:     { label: 'PG / Guest House', color: 'bg-accent-light text-warning',  Icon: Home      },
  shared: { label: 'Shared Apartment', color: 'bg-success-light text-success', Icon: Users     },
}

export default function ProfilePage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const setUser   = useAuthStore((s) => s.setUser)
  const clear     = useAuthStore((s) => s.clear)
  const propType  = user?.hostel?.property_type
  const propConf  = propType ? PROP_TYPE_CONFIG[propType] : null

  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [fullName, setFullName] = useState(user?.profile.full_name ?? '')
  const [phone,    setPhone]    = useState(user?.profile.phone ?? '')

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', user.id)
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    // Update the store immediately so TopBar and other components reflect the new name
    setUser({ ...user, profile: { ...user.profile, full_name: fullName, phone: phone || null } })
    toast.success('Profile updated')
    setEditing(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    clear()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Profile" showBack={false} />

      <div className="pt-14 px-4 space-y-5">

        {/* ── Avatar + name ── */}
        <div className="flex flex-col items-center pt-4 pb-2 gap-3">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-[28px] font-bold shadow-raised"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <div className="text-center">
            <p className="text-[20px] font-bold text-text-primary">{user?.profile.full_name}</p>
            <p className="text-[13px] text-text-secondary capitalize mt-0.5">{user?.profile.role} · {user?.hostel?.name ?? 'No hostel'}</p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-5 py-1.5 border border-primary rounded-pill text-[13px] font-semibold text-primary hover:bg-primary-light transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* ── Edit form ── */}
        {editing && (
          <div className="bg-surface rounded-card shadow-card p-4 space-y-4">
            <p className="text-[15px] font-bold text-text-primary">Edit Profile</p>
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User size={16} />}
            />
            <Input
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone size={16} />}
              placeholder="+91 98765 43210"
            />
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="dark" fullWidth loading={saving} onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        )}

        {/* ── Place type badge ── */}
        {propConf && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-inner self-start mx-auto ${propConf.color}`}>
            <propConf.Icon size={14} />
            <span className="text-[13px] font-semibold">{propConf.label}</span>
          </div>
        )}

        {/* ── Info cards ── */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <InfoRow icon={<User size={16} />}      label="Full Name" value={user?.profile.full_name ?? '—'} />
          <InfoRow icon={<Phone size={16} />}     label="Phone"     value={user?.profile.phone ?? 'Not set'} />
          <InfoRow icon={<Hash size={16} />}      label="Room"      value={user?.profile.room_number ? `Room ${user.profile.room_number}` : 'Not assigned'} />
          <InfoRow icon={<Building2 size={16} />} label="Place"     value={user?.hostel?.name ?? 'Not linked'} />
          {user?.hostel && (
            <InfoRow
              icon={<Hash size={16} />}
              label="Place Code"
              value={user.hostel.hostel_code ?? '—'}
              last
            />
          )}
        </div>

        {/* ── Change place ── */}
        {!user?.profile.hostel_id && (
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full bg-primary-light rounded-card px-4 py-3.5 flex items-center justify-between"
          >
            <p className="text-[14px] font-semibold text-primary">Join or create a place</p>
            <ChevronRight size={16} className="text-primary" />
          </button>
        )}

        {/* ── Settings ── */}
        <div>
          <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">Settings</p>
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            <SettingsRow icon={<Bell size={16} />}       label="Notifications"    onClick={() => navigate('/notifications')} />
            <SettingsRow icon={<Shield size={16} />}     label="Privacy & Safety" onClick={() => toast('Your data is stored securely and never sold. Contact support@ashiyaan.app for data requests.')} />
            <SettingsRow icon={<HelpCircle size={16} />} label="Help & Support"   onClick={() => toast('Email us at support@ashiyaan.app or ask your warden for help.')} />
            <SettingsRow icon={<Info size={16} />}       label="About Ashiyaan"   value="v1.0" onClick={() => toast('Ashiyaan v1.0 — making hostel, PG & shared-living management simple.')} last />
          </div>
        </div>

        {/* ── Sign out ── */}
        <button
          onClick={handleSignOut}
          className="w-full bg-surface rounded-card shadow-card px-4 py-4 flex items-center gap-3 text-danger active:bg-danger-light transition-colors"
        >
          <LogOut size={18} />
          <span className="text-[15px] font-semibold">Sign Out</span>
        </button>

      </div>
    </div>
  )
}

function InfoRow({
  icon, label, value, last = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  last?: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="text-text-tertiary flex-shrink-0">{icon}</span>
        <span className="text-[13px] text-text-tertiary flex-1">{label}</span>
        <span className="text-[14px] font-medium text-text-primary text-right">{value}</span>
      </div>
      {!last && <div className="h-px bg-border mx-4" />}
    </div>
  )
}

function SettingsRow({
  icon, label, value, onClick, last = false,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <div>
      <button
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-3.5 w-full hover:bg-surface-raised transition-colors"
      >
        <span className="text-text-secondary flex-shrink-0">{icon}</span>
        <span className="text-[14px] font-medium text-text-primary flex-1 text-left">{label}</span>
        {value
          ? <span className="text-[13px] text-text-tertiary">{value}</span>
          : <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />}
      </button>
      {!last && <div className="h-px bg-border mx-4" />}
    </div>
  )
}
