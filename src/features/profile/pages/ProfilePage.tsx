import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Hash, Building2, LogOut, ChevronRight, Shield, Bell, BellRing, HelpCircle, Info, Home, Users, Moon, Calendar, GraduationCap, Heart, Droplet, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { useThemeStore } from '@/store/theme.store'
import { TopBar } from '@/components/layout/TopBar'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { isPushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/services/push.service'

const PROP_TYPE_CONFIG = {
  hostel: { label: 'Hostel',           color: 'bg-primary-light text-primary', Icon: Building2 },
  pg:     { label: 'PG / Guest House', color: 'bg-accent-light text-warning',  Icon: Home      },
  shared: { label: 'Shared Apartment', color: 'bg-success-light text-success', Icon: Users     },
}

export default function ProfilePage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const setUser     = useAuthStore((s) => s.setUser)
  const clear       = useAuthStore((s) => s.clear)
  const theme       = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const propType  = user?.hostel?.property_type
  const propConf  = propType ? PROP_TYPE_CONFIG[propType] : null

  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [fullName, setFullName] = useState(user?.profile.full_name ?? '')
  const [phone,    setPhone]    = useState(user?.profile.phone ?? '')

  const [editingDetails,  setEditingDetails]  = useState(false)
  const [savingDetails,   setSavingDetails]   = useState(false)
  const [details, setDetails] = useState({
    college_name:       user?.profile.college_name       ?? '',
    course:             user?.profile.course             ?? '',
    college_year:       user?.profile.college_year       ?? '',
    student_id:         user?.profile.student_id         ?? '',
    date_of_birth:      user?.profile.date_of_birth      ?? '',
    blood_group:        user?.profile.blood_group        ?? '',
    aadhaar_number:     user?.profile.aadhaar_number     ?? '',
    hometown:           user?.profile.hometown           ?? '',
    parent_name:        user?.profile.parent_name        ?? '',
    parent_phone:       user?.profile.parent_phone       ?? '',
    allergies:          user?.profile.allergies          ?? '',
    medical_conditions: user?.profile.medical_conditions ?? '',
  })

  function setD(k: keyof typeof details) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDetails((d) => ({ ...d, [k]: e.target.value }))
  }

  const initials    = user ? getInitials(user.profile.full_name) : '?'
  const avatarColor = user ? getAvatarColor(user.profile.full_name) : '#1A3D3D'

  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled,   setPushEnabled]   = useState(false)
  const [pushBusy,      setPushBusy]      = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    setPushSupported(true)
    getPushSubscription().then((sub) => setPushEnabled(!!sub))
  }, [])

  async function handlePushToggle(enabled: boolean) {
    if (!user) return
    setPushBusy(true)
    try {
      if (enabled) {
        await subscribeToPush(user.id)
        toast.success('Push notifications enabled')
      } else {
        await unsubscribeFromPush(user.id)
        toast.success('Push notifications disabled')
      }
      setPushEnabled(enabled)
    } catch {
      toast.error('Could not update push notification settings')
    } finally {
      setPushBusy(false)
    }
  }

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

  async function handleSaveDetails() {
    if (!user) return
    setSavingDetails(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        college_name:       details.college_name       || null,
        course:             details.course             || null,
        college_year:       details.college_year       || null,
        student_id:         details.student_id         || null,
        date_of_birth:      details.date_of_birth      || null,
        blood_group:        details.blood_group        || null,
        aadhaar_number:     details.aadhaar_number     || null,
        hometown:           details.hometown           || null,
        parent_name:        details.parent_name        || null,
        parent_phone:       details.parent_phone       || null,
        allergies:          details.allergies          || null,
        medical_conditions: details.medical_conditions || null,
      })
      .eq('id', user.id)
    setSavingDetails(false)
    if (error) { toast.error('Failed to save'); return }
    setUser({
      ...user,
      profile: {
        ...user.profile,
        college_name:       details.college_name       || null,
        course:             details.course             || null,
        college_year:       details.college_year       || null,
        student_id:         details.student_id         || null,
        date_of_birth:      details.date_of_birth      || null,
        blood_group:        details.blood_group        || null,
        aadhaar_number:     details.aadhaar_number     || null,
        hometown:           details.hometown           || null,
        parent_name:        details.parent_name        || null,
        parent_phone:       details.parent_phone       || null,
        allergies:          details.allergies          || null,
        medical_conditions: details.medical_conditions || null,
      },
    })
    toast.success('Details updated')
    setEditingDetails(false)
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

        {/* ── My Room & Roommates ── */}
        {user?.profile.room_number && (
          <button
            onClick={() => navigate('/my-room')}
            className="w-full bg-surface rounded-card shadow-card px-4 py-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
                <Users size={16} />
              </span>
              <div className="text-left">
                <p className="text-[14px] font-semibold text-text-primary">My Room & Roommates</p>
                <p className="text-[12px] text-text-tertiary">Room {user.profile.room_number}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
          </button>
        )}

        {/* ── Outpass / Leave Requests ── */}
        {(propType === 'hostel' || propType === 'pg') && user?.profile.role === 'student' && (
          <button
            onClick={() => navigate('/leave')}
            className="w-full bg-surface rounded-card shadow-card px-4 py-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary flex-shrink-0">
                <Calendar size={16} />
              </span>
              <div className="text-left">
                <p className="text-[14px] font-semibold text-text-primary">Outpass / Leave Requests</p>
                <p className="text-[12px] text-text-tertiary">Apply for leave or check status</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
          </button>
        )}

        {/* ── Academic & Emergency Details (students only) ── */}
        {user?.profile.role === 'student' && (
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
              <p className="text-[14px] font-semibold text-text-primary">Academic & Emergency Details</p>
              {!editingDetails && (
                <button
                  onClick={() => setEditingDetails(true)}
                  className="text-[13px] font-semibold text-primary"
                >
                  Edit
                </button>
              )}
            </div>

            {!editingDetails ? (
              <div>
                <InfoRow icon={<GraduationCap size={16} />} label="College"    value={user.profile.college_name    ?? 'Not set'} />
                <InfoRow icon={<GraduationCap size={16} />} label="Course"     value={user.profile.course          ?? 'Not set'} />
                <InfoRow icon={<GraduationCap size={16} />} label="Year"       value={user.profile.college_year    ?? 'Not set'} />
                <InfoRow icon={<Hash size={16} />}          label="Enrollment" value={user.profile.student_id      ?? 'Not set'} />
                <InfoRow icon={<User size={16} />}          label="DOB"        value={user.profile.date_of_birth   ?? 'Not set'} />
                <InfoRow icon={<Droplet size={16} />}       label="Blood"      value={user.profile.blood_group     ?? 'Not set'} />
                <InfoRow icon={<Hash size={16} />}          label="Aadhaar"    value={user.profile.aadhaar_number  ?? 'Not set'} />
                <InfoRow icon={<MapPin size={16} />}        label="Hometown"   value={user.profile.hometown        ?? 'Not set'} />
                <InfoRow icon={<Phone size={16} />}         label="Parent"     value={user.profile.parent_name     ?? 'Not set'} />
                <InfoRow icon={<Phone size={16} />}         label="Parent Ph." value={user.profile.parent_phone    ?? 'Not set'} />
                {user.profile.allergies && (
                  <InfoRow icon={<Heart size={16} />} label="Allergies"  value={user.profile.allergies} />
                )}
                {user.profile.medical_conditions && (
                  <InfoRow icon={<Heart size={16} />} label="Medical"    value={user.profile.medical_conditions} last />
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {(() => {
                  const sel = 'w-full rounded-inner border border-border bg-surface px-3 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'
                  return (
                    <>
                      <Input label="College name"          value={details.college_name}       onChange={setD('college_name')}       placeholder="e.g. Delhi University" />
                      <Input label="Course / Branch"       value={details.course}             onChange={setD('course')}             placeholder="e.g. B.Tech ECE" />
                      <div>
                        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Year of study</label>
                        <select value={details.college_year} onChange={setD('college_year')} className={sel}>
                          <option value="">Select year</option>
                          {['1st Year','2nd Year','3rd Year','4th Year','5th Year','Other'].map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <Input label="Enrollment / Roll no." value={details.student_id}         onChange={setD('student_id')}         placeholder="e.g. 2021CS1234" />
                      <Input label="Date of birth"         type="date" value={details.date_of_birth}  onChange={setD('date_of_birth')} />
                      <div>
                        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Blood group</label>
                        <select value={details.blood_group} onChange={setD('blood_group')} className={sel}>
                          <option value="">Select</option>
                          {['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>
                      <Input label="Aadhaar number"        value={details.aadhaar_number}     onChange={setD('aadhaar_number')}     placeholder="12-digit number" />
                      <Input label="Hometown"              value={details.hometown}           onChange={setD('hometown')}           placeholder="e.g. Patna, Bihar" />
                      <Input label="Parent name"           value={details.parent_name}        onChange={setD('parent_name')}        placeholder="e.g. Ramesh Sharma" />
                      <Input label="Parent phone"          type="tel" value={details.parent_phone}  onChange={setD('parent_phone')}  placeholder="+91 98765 43210" />
                      <Input label="Allergies (optional)"  value={details.allergies}          onChange={setD('allergies')}          placeholder="e.g. Penicillin" />
                      <Input label="Medical (optional)"    value={details.medical_conditions} onChange={setD('medical_conditions')} placeholder="e.g. Asthma" />
                      <div className="flex gap-3 pt-1">
                        <Button variant="secondary" fullWidth onClick={() => setEditingDetails(false)}>Cancel</Button>
                        <Button variant="dark"      fullWidth loading={savingDetails} onClick={handleSaveDetails}>Save</Button>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

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
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-text-secondary flex-shrink-0"><Moon size={16} /></span>
              <span className="text-[14px] font-medium text-text-primary flex-1">Dark Mode</span>
              <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
            </div>
            {pushSupported && (
              <>
                <div className="h-px bg-border mx-4" />
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="text-text-secondary flex-shrink-0"><BellRing size={16} /></span>
                  <span className="text-[14px] font-medium text-text-primary flex-1">Push Notifications</span>
                  <Toggle checked={pushEnabled} disabled={pushBusy} onChange={handlePushToggle} />
                </div>
              </>
            )}
            <div className="h-px bg-border mx-4" />
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
