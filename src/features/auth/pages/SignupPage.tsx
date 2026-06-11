import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, Phone, ArrowRight, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OtpInput } from '@/components/ui/OtpInput'

type Step = 'form' | 'otp'

const RESEND_COOLDOWN = 60

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[12px] text-text-tertiary font-medium">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export default function SignupPage() {
  const [step,         setStep]         = useState<Step>('form')
  const [loading,      setLoading]      = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,        setError]        = useState('')
  const [otp,          setOtp]          = useState('')
  const [resendTimer,  setResendTimer]  = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function startResendTimer() {
    setResendTimer(RESEND_COOLDOWN)
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function handleGoogleSignIn() {
    setError('')
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setGoogleLoading(false)
    if (error) setError(error.message)
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: form.phone,
      options: {
        shouldCreateUser: true,
        data: { full_name: form.full_name, email: form.email },
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    startResendTimer()
    setStep('otp')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: form.phone,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      setError(
        error.message.includes('expired') || error.message.includes('invalid')
          ? 'Code is invalid or expired. Request a new one.'
          : error.message
      )
      return
    }
    // No manual navigate — GuestGuard redirects to /dashboard, then
    // OnboardingGuard redirects to /onboarding since hostel_id is null for new users.
  }

  async function handleResendOtp() {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: form.phone,
      options: {
        shouldCreateUser: true,
        data: { full_name: form.full_name, email: form.email },
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    startResendTimer()
    setOtp('')
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary rounded-[20px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-2xl font-bold">A</span>
        </div>
        <h1 className="text-[24px] font-bold text-text-primary">Create Account</h1>
        <p className="text-[14px] text-text-secondary mt-1">Join Ashiyaan</p>
      </div>

      <div className="w-full max-w-sm bg-surface rounded-card shadow-card p-6">

        {step === 'form' ? (
          <>
            <h2 className="text-[18px] font-bold text-text-primary mb-5">Your details</h2>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 border border-border rounded-input bg-surface-raised text-[14px] font-semibold text-text-primary hover:bg-border transition-colors disabled:opacity-60"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            <Divider />

            <form onSubmit={handleSendOtp} className="space-y-4">
              <Input
                label="Full name"
                placeholder="Rahul Sharma"
                value={form.full_name}
                onChange={set('full_name')}
                leftIcon={<User size={16} />}
                required
                autoFocus
              />
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                leftIcon={<Mail size={16} />}
                required
              />
              <Input
                label="Phone number"
                type="tel"
                placeholder="+919876543210"
                value={form.phone}
                onChange={set('phone')}
                leftIcon={<Phone size={16} />}
                required
              />
              {error && <p className="text-[12px] text-danger">{error}</p>}
              <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
                Send Verification Code
              </Button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-bold text-text-primary mb-1">Verify phone</h2>
            <p className="text-[13px] text-text-secondary mb-5">
              Enter the code sent to{' '}
              <span className="font-semibold text-text-primary">{form.phone}</span>
            </p>
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <OtpInput
                value={otp}
                onChange={setOtp}
                error={error}
                autoFocus
              />
              <Button
                type="submit"
                fullWidth
                variant="dark"
                loading={loading}
                disabled={otp.length < 6}
              >
                Verify & Continue
              </Button>

              {/* Resend row */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(''); setError('') }}
                  className="text-[13px] text-text-secondary"
                >
                  Change phone number
                </button>
                {resendTimer > 0 ? (
                  <span className="text-[13px] text-text-tertiary flex items-center gap-1">
                    <RefreshCw size={12} /> Resend in {resendTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-[13px] text-info font-semibold flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Resend code
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      <p className="text-[13px] text-text-tertiary mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-info font-semibold">Sign in</Link>
      </p>
    </div>
  )
}
