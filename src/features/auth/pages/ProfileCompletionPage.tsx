import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Heart, ArrowRight, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@/types/app.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] as const
const COLLEGE_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Other'] as const

export default function ProfileCompletionPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const setUser  = useAuthStore((s) => s.setUser)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    college_name:       '',
    course:             '',
    college_year:       '' as string,
    student_id:         user?.profile.student_id        ?? '',
    date_of_birth:      '',
    blood_group:        '' as string,
    aadhaar_number:     '',
    hometown:           '',
    parent_name:        '',
    parent_phone:       '',
    allergies:          '',
    medical_conditions: '',
  })

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        college_name:       form.college_name       || null,
        course:             form.course             || null,
        college_year:       form.college_year       || null,
        student_id:         form.student_id         || null,
        date_of_birth:      form.date_of_birth      || null,
        blood_group:        form.blood_group        || null,
        aadhaar_number:     form.aadhaar_number     || null,
        hometown:           form.hometown           || null,
        parent_name:        form.parent_name        || null,
        parent_phone:       form.parent_phone       || null,
        allergies:          form.allergies          || null,
        medical_conditions: form.medical_conditions || null,
        profile_completed:  true,
      })
      .eq('id', user!.id)

    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    // Refresh full profile (including hostels join) so store is accurate
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, hostels(*)')
        .eq('id', authUser.id)
        .single()
      if (profile) {
        setUser({
          id:      authUser.id,
          email:   authUser.email,
          profile: profile as AuthUser['profile'],
          hostel:  (profile as unknown as { hostels: AuthUser['hostel'] }).hostels ?? null,
        })
      }
    }

    setLoading(false)
    toast.success('Profile complete! Welcome to Ashiyaan.')
    navigate('/dashboard')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    useAuthStore.getState().clear()
    navigate('/login')
  }

  const selectClass =
    'w-full rounded-inner border border-border bg-surface px-3 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-start px-5 py-10">

      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-primary rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-xl font-black">A</span>
        </div>
        <h1 className="text-[22px] font-bold text-text-primary">Complete Your Profile</h1>
        <p className="text-[13px] text-text-secondary mt-1">
          Your warden needs these details before you can enter.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">

        {/* Academic Details */}
        <div className="bg-surface rounded-card shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={16} className="text-primary" />
            <p className="text-[15px] font-bold text-text-primary">Academic Details</p>
          </div>

          <Input
            label="College / University name"
            placeholder="e.g. Delhi University"
            value={form.college_name}
            onChange={setF('college_name')}
            required
          />
          <Input
            label="Course / Branch"
            placeholder="e.g. B.Tech ECE"
            value={form.course}
            onChange={setF('course')}
            required
          />

          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Year of study <span className="text-danger">*</span>
            </label>
            <select
              value={form.college_year}
              onChange={setF('college_year')}
              required
              className={selectClass}
            >
              <option value="" disabled>Select year</option>
              {COLLEGE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <Input
            label="Enrollment / Roll number"
            placeholder="e.g. 2021CS1234"
            value={form.student_id}
            onChange={setF('student_id')}
            required
          />
        </div>

        {/* Personal & Emergency */}
        <div className="bg-surface rounded-card shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart size={16} className="text-danger" />
            <p className="text-[15px] font-bold text-text-primary">Personal & Emergency</p>
          </div>

          <Input
            label="Date of birth"
            type="date"
            value={form.date_of_birth}
            onChange={setF('date_of_birth')}
            required
          />

          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Blood group <span className="text-danger">*</span>
            </label>
            <select
              value={form.blood_group}
              onChange={setF('blood_group')}
              required
              className={selectClass}
            >
              <option value="" disabled>Select blood group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <Input
            label="Aadhaar number"
            placeholder="12-digit number"
            value={form.aadhaar_number}
            onChange={setF('aadhaar_number')}
            required
          />
          <Input
            label="Hometown / Native city"
            placeholder="e.g. Patna, Bihar"
            value={form.hometown}
            onChange={setF('hometown')}
            required
          />
          <Input
            label="Parent / Guardian name"
            placeholder="e.g. Ramesh Sharma"
            value={form.parent_name}
            onChange={setF('parent_name')}
            required
          />
          <Input
            label="Parent / Guardian phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.parent_phone}
            onChange={setF('parent_phone')}
            required
          />
          <Input
            label="Known allergies (optional)"
            placeholder="e.g. Penicillin, Peanuts"
            value={form.allergies}
            onChange={setF('allergies')}
          />
          <Input
            label="Medical conditions (optional)"
            placeholder="e.g. Asthma, Diabetes"
            value={form.medical_conditions}
            onChange={setF('medical_conditions')}
          />
        </div>

        {error && (
          <div className="bg-danger-light rounded-inner px-3 py-2">
            <p className="text-[13px] text-danger">{error}</p>
          </div>
        )}

        <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
          Save & Enter
        </Button>

        <button
          type="button"
          onClick={handleLogout}
          className="text-[12px] text-text-secondary flex items-center gap-1.5 mx-auto hover:text-danger transition-colors"
        >
          <LogOut size={12} /> Log out
        </button>

      </form>
    </div>
  )
}
