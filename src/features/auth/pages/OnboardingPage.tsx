import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Home, Users, ArrowRight, ArrowLeft,
  MapPin, Phone, Hash, CheckCircle2, Copy, Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@/types/app.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step     = 'choose' | 'join' | 'create-type' | 'create-form' | 'success'
type PropType = 'hostel' | 'pg' | 'shared'

const PROP_TYPES: { type: PropType; title: string; desc: string; color: string; textColor: string; Icon: React.ElementType }[] = [
  {
    type: 'hostel', Icon: Building2,
    title: 'Hostel',
    desc: 'Managed accommodation with warden. 20+ residents, gate pass, mess management.',
    color: 'bg-primary-light border-primary/30', textColor: 'text-primary',
  },
  {
    type: 'pg', Icon: Home,
    title: 'PG / Guest House',
    desc: 'Paying guest accommodation. Smaller scale, landlord managed.',
    color: 'bg-accent-light border-accent/30', textColor: 'text-warning',
  },
  {
    type: 'shared', Icon: Users,
    title: 'Shared Apartment',
    desc: '2–6 flatmates living together. Equal roles, expense splitting, no warden.',
    color: 'bg-success-light border-success/30', textColor: 'text-success',
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const setUser  = useAuthStore((s) => s.setUser)

  const [step,     setStep]     = useState<Step>('choose')
  const [propType, setPropType] = useState<PropType>('hostel')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [code,     setCode]     = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [createdName, setCreatedName] = useState('')

  const [form, setForm] = useState({
    name: '', city: '', state: '', contact_phone: '', total_rooms: '',
  })

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  // Returns true only when the store has been updated with a valid hostel_id.
  // Callers must check the return value before navigating.
  async function refreshProfile(): Promise<boolean> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return false
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, hostels(*)')
      .eq('id', authUser.id)
      .single()
    if (!profile) return false
    setUser({
      id: authUser.id,
      email: authUser.email,
      profile: profile as AuthUser['profile'],
      hostel: (profile as unknown as { hostels: AuthUser['hostel'] }).hostels ?? null,
    })
    // Only consider it a success when the profile actually has a hostel attached.
    return !!(profile as unknown as { hostel_id?: string | null }).hostel_id
  }

  // ── Join flow ────────────────────────────────────────────────
  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data, error: rpcErr } = await supabase
      .rpc('join_hostel_by_code', { p_code: code.toUpperCase().trim() })

    if (rpcErr) {
      setError(rpcErr.message.includes('Invalid code')
        ? 'Invalid code — double check with your warden or flatmate.'
        : rpcErr.message)
      setLoading(false); return
    }

    const ok = await refreshProfile()
    setLoading(false)
    if (!ok) {
      setError('Joined successfully, but we could not load your profile. Please refresh the page.')
      return
    }
    const result = data as { name: string; property_type: string }
    toast.success(`Joined ${result.name}!`)
    // Route based on the refreshed role — a warden rejoining goes to the manager view
    const role = useAuthStore.getState().user?.profile.role
    navigate(role === 'warden' || role === 'manager' ? '/manager' : '/dashboard')
  }

  // ── Create flow ──────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setError(''); setLoading(true)

    const { data, error: rpcErr } = await supabase.rpc('create_hostel_for_user', {
      p_name:          form.name.trim(),
      p_city:          form.city.trim()          || undefined,
      p_state:         form.state.trim()         || undefined,
      p_contact_phone: form.contact_phone.trim() || undefined,
      p_total_rooms:   form.total_rooms ? Number(form.total_rooms) : undefined,
      p_property_type: propType,
    })

    if (rpcErr) { setError(rpcErr.message); setLoading(false); return }

    const result = data as { hostel_code: string; name: string }
    const ok = await refreshProfile()
    setLoading(false)
    if (!ok) {
      setError('Place created, but we could not load your profile. Please refresh the page.')
      return
    }
    setCreatedCode(result.hostel_code)
    setCreatedName(result.name)
    setStep('success')
  }

  function copyCode() {
    navigator.clipboard.writeText(createdCode)
    toast.success('Code copied!')
  }

  async function shareCode() {
    if (navigator.share) {
      await navigator.share({
        title: 'Join me on Ashiyaan',
        text: `Join ${createdName} on Ashiyaan using code: ${createdCode}`,
      })
    } else {
      copyCode()
    }
  }

  const totalSteps = step === 'join' ? 2 : 3
  const currentStep = step === 'choose' ? 1 : step === 'join' ? 2 : step === 'create-type' ? 2 : step === 'create-form' ? 3 : 3

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 py-10">

      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-primary rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-xl font-black">A</span>
        </div>
        <h1 className="text-[22px] font-bold text-text-primary">Ashiyaan</h1>
      </div>

      {/* Progress dots */}
      {step !== 'success' && (
        <div className="flex gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${
                i < currentStep
                  ? 'w-6 h-2 bg-primary'
                  : 'w-2 h-2 bg-border'
              }`}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-sm">

        {/* ── Step 1: Choose ── */}
        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-[20px] font-bold text-text-primary text-center mb-5">
              Welcome! How would you like to get started?
            </p>

            <button
              onClick={() => setStep('join')}
              className="w-full bg-surface rounded-card shadow-card p-5 flex items-center gap-4 active:scale-[0.98] transition-transform text-left border-2 border-transparent hover:border-primary/20"
            >
              <div className="w-12 h-12 bg-primary-light rounded-inner flex items-center justify-center flex-shrink-0">
                <Hash size={22} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-bold text-text-primary">Join an existing place</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  I have a code from my warden or flatmate
                </p>
              </div>
              <ArrowRight size={18} className="text-text-tertiary flex-shrink-0" />
            </button>

            <button
              onClick={() => setStep('create-type')}
              className="w-full bg-surface rounded-card shadow-card p-5 flex items-center gap-4 active:scale-[0.98] transition-transform text-left border-2 border-transparent hover:border-primary/20"
            >
              <div className="w-12 h-12 bg-accent-light rounded-inner flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-bold text-text-primary">Set up a new place</p>
                <p className="text-[13px] text-text-secondary mt-0.5">
                  I'm a warden, landlord or setting up a flat
                </p>
              </div>
              <ArrowRight size={18} className="text-text-tertiary flex-shrink-0" />
            </button>
          </div>
        )}

        {/* ── Step 2a: Join by code ── */}
        {step === 'join' && (
          <div className="bg-surface rounded-card shadow-card p-6">
            <button onClick={() => { setStep('choose'); setError('') }} className="flex items-center gap-1.5 text-[13px] text-text-secondary mb-5">
              <ArrowLeft size={14} /> Back
            </button>
            <h2 className="text-[20px] font-bold text-text-primary mb-1">Enter your place code</h2>
            <p className="text-[13px] text-text-secondary mb-5">
              Ask your warden or flatmate — it looks like <span className="font-semibold text-text-primary">SUN-281</span>
            </p>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="relative">
                <Input
                  label="Place code"
                  placeholder="e.g. SUN-281"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  leftIcon={<Hash size={16} />}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <div className="bg-danger-light rounded-inner px-3 py-2">
                  <p className="text-[13px] text-danger">{error}</p>
                </div>
              )}
              <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
                Join Place
              </Button>
            </form>
          </div>
        )}

        {/* ── Step 2b: Property type ── */}
        {step === 'create-type' && (
          <div>
            <button onClick={() => { setStep('choose'); setError('') }} className="flex items-center gap-1.5 text-[13px] text-text-secondary mb-4 px-1">
              <ArrowLeft size={14} /> Back
            </button>
            <p className="text-[20px] font-bold text-text-primary px-1 mb-5">
              What kind of place is it?
            </p>
            <div className="space-y-3">
              {PROP_TYPES.map(({ type, Icon, title, desc, color, textColor }) => (
                <button
                  key={type}
                  onClick={() => { setPropType(type); setStep('create-form') }}
                  className={`w-full rounded-card p-5 flex items-start gap-4 active:scale-[0.98] transition-transform text-left border-2 ${color}`}
                >
                  <div className={`w-11 h-11 rounded-inner bg-white/70 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon size={20} className={textColor} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-[16px] font-bold ${textColor}`}>{title}</p>
                    <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">{desc}</p>
                  </div>
                  <ArrowRight size={16} className="text-text-tertiary flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Create form ── */}
        {step === 'create-form' && (
          <div className="bg-surface rounded-card shadow-card p-6">
            <button onClick={() => { setStep('create-type'); setError('') }} className="flex items-center gap-1.5 text-[13px] text-text-secondary mb-5">
              <ArrowLeft size={14} /> Back
            </button>

            {/* Selected type badge */}
            {(() => {
              const conf = PROP_TYPES.find((p) => p.type === propType)!
              return (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[12px] font-semibold mb-3 ${conf.color} ${conf.textColor}`}>
                  <conf.Icon size={13} />
                  {conf.title}
                </div>
              )
            })()}

            <h2 className="text-[20px] font-bold text-text-primary mb-5">
              {propType === 'shared' ? 'Tell us about your apartment' : 'Set up your place'}
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label={propType === 'shared' ? 'Apartment name' : propType === 'pg' ? 'PG name' : 'Hostel name'}
                placeholder={
                  propType === 'shared' ? 'e.g. Skyline Flat 3B' :
                  propType === 'pg'     ? 'e.g. Sharma PG'       :
                                          'e.g. Sunrise Boys Hostel'
                }
                value={form.name}
                onChange={setF('name')}
                leftIcon={<Building2 size={16} />}
                required
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                <Input label="City" placeholder="Bangalore" value={form.city} onChange={setF('city')} leftIcon={<MapPin size={16} />} />
                <Input label="State" placeholder="Karnataka" value={form.state} onChange={setF('state')} />
              </div>

              {propType !== 'shared' && (
                <Input label="Contact phone" type="tel" placeholder="+91 98765 43210" value={form.contact_phone} onChange={setF('contact_phone')} leftIcon={<Phone size={16} />} />
              )}

              <Input
                label={propType === 'shared' ? 'Number of flatmates' : 'Total rooms'}
                type="number"
                placeholder={propType === 'shared' ? '3' : '60'}
                value={form.total_rooms}
                onChange={setF('total_rooms')}
              />

              {error && (
                <div className="bg-danger-light rounded-inner px-3 py-2">
                  <p className="text-[13px] text-danger">{error}</p>
                </div>
              )}

              <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
                Create {propType === 'shared' ? 'Apartment' : propType === 'pg' ? 'PG' : 'Hostel'}
              </Button>
            </form>
          </div>
        )}

        {/* ── Success screen ── */}
        {step === 'success' && (
          <div className="space-y-4">
            <div className="bg-surface rounded-card shadow-card p-6 text-center space-y-3">
              <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-success" />
              </div>
              <div>
                <p className="text-[20px] font-bold text-text-primary">{createdName} is ready!</p>
                <p className="text-[13px] text-text-secondary mt-1">
                  Share the code below with your {propType === 'shared' ? 'flatmates' : 'residents'}
                </p>
              </div>

              {/* Shareable code */}
              <div className="bg-canvas rounded-inner p-4 space-y-2">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest">Place Code</p>
                <p className="text-[36px] font-black text-primary tracking-[0.1em]">{createdCode}</p>
                <p className="text-[12px] text-text-secondary">
                  Anyone with this code can join your {propType === 'shared' ? 'apartment' : propType}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={copyCode}
                  className="flex items-center justify-center gap-2 py-3 bg-surface-raised rounded-btn text-[14px] font-semibold text-text-secondary border border-border hover:bg-border transition-colors"
                >
                  <Copy size={15} /> Copy Code
                </button>
                <button
                  onClick={shareCode}
                  className="flex items-center justify-center gap-2 py-3 bg-primary rounded-btn text-[14px] font-semibold text-white"
                >
                  <Share2 size={15} /> Share
                </button>
              </div>
            </div>

            <Button
              fullWidth
              variant="dark"
              onClick={() => navigate(propType === 'shared' ? '/dashboard' : '/manager')}
              rightIcon={<ArrowRight size={16} />}
            >
              Go to Dashboard
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}
