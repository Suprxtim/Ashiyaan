import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, ArrowRight, KeyRound, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OtpInput } from '@/components/ui/OtpInput'

type Method = 'email' | 'phone'
type Step   = 'send' | 'verify' | 'password' | 'forgot' | 'forgot-sent'

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

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return raw.trim()
}

export default function LoginPage() {
  const [method,        setMethod]        = useState<Method>('email')
  const [step,          setStep]          = useState<Step>('send')
  const [email,         setEmail]         = useState('')
  const [phone,         setPhone]         = useState('')
  const [password,      setPassword]      = useState('')
  const [otp,           setOtp]           = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,         setError]         = useState('')
  const [resendTimer,   setResendTimer]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  function switchMethod(m: Method) {
    setMethod(m); setStep('send'); setOtp(''); setError('')
  }

  async function handleGoogleSignIn() {
    setError(''); setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setGoogleLoading(false)
    if (error) setError(error.message)
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)

    if (method === 'email') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      setLoading(false)
      if (error) {
        setError(
          error.message.toLowerCase().includes('not found') || error.message.toLowerCase().includes('user')
            ? 'No account found for this email. Did you mean to sign up?'
            : error.message
        )
        return
      }
    } else {
      const normalized = normalizePhone(phone)
      setPhone(normalized)
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalized,
        options: { shouldCreateUser: false },
      })
      setLoading(false)
      if (error) {
        setError(
          error.message.toLowerCase().includes('sms') || error.message.toLowerCase().includes('provider')
            ? 'Phone login is not yet available. Please use email instead.'
            : error.message.toLowerCase().includes('not found') || error.message.toLowerCase().includes('user')
            ? 'No account found for this number. Did you mean to sign up?'
            : error.message
        )
        return
      }
    }

    startResendTimer()
    setStep('verify')
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { error } = method === 'email'
      ? await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
      : await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })

    setLoading(false)
    if (error) {
      setError(
        error.message.includes('expired') || error.message.includes('invalid')
          ? 'Code is invalid or expired. Request a new one.'
          : error.message
      )
    }
    // No manual navigate — GuestGuard redirects automatically once session is set
  }

  async function handleResend() {
    setError(''); setLoading(true)
    if (method === 'email') {
      await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    } else {
      await supabase.auth.signInWithOtp({ phone: normalizePhone(phone), options: { shouldCreateUser: false } })
    }
    setLoading(false)
    startResendTimer()
    setOtp('')
  }

  async function handlePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(
        error.message.includes('Invalid login credentials')
          ? 'Invalid email or password.'
          : error.message
      )
    }
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('forgot-sent')
  }

  const identifier = method === 'email' ? email : phone

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 py-10">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary rounded-[20px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-2xl font-bold">A</span>
        </div>
        <h1 className="text-[24px] font-bold text-text-primary">Ashiyaan</h1>
        <p className="text-[14px] text-text-secondary mt-1">Your home, smarter</p>
      </div>

      <div className="w-full max-w-sm bg-surface rounded-card shadow-card p-6">

        {/* ── OTP send ── */}
        {step === 'send' && (
          <>
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 border border-border rounded-input bg-surface-raised text-[14px] font-semibold text-text-primary hover:bg-border transition-colors disabled:opacity-60 mb-5"
            >
              {googleLoading
                ? <span className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
                : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[12px] text-text-tertiary font-medium">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Method tabs */}
            <div className="flex bg-canvas rounded-inner p-1 mb-5">
              {(['email', 'phone'] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMethod(m)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[6px] text-[13px] font-semibold transition-colors ${
                    method === m
                      ? 'bg-surface shadow-card text-text-primary'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {m === 'email' ? <Mail size={14} /> : <Phone size={14} />}
                  {m === 'email' ? 'Email' : 'Phone'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSend} className="space-y-4">
              {method === 'email' ? (
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail size={16} />}
                  required
                  autoFocus
                />
              ) : (
                <Input
                  label="Phone number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone size={16} />}
                  required
                  autoFocus
                />
              )}
              {error && <p className="text-[12px] text-danger">{error}</p>}
              <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
                Send Code
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => { setStep('password'); setError('') }}
                className="text-[12px] text-text-tertiary"
              >
                Sign in with password instead
              </button>
            </div>
          </>
        )}

        {/* ── OTP verify ── */}
        {step === 'verify' && (
          <>
            <h2 className="text-[20px] font-bold text-text-primary mb-1">Enter code</h2>
            <p className="text-[14px] text-text-secondary mb-6">
              Sent to <span className="font-semibold text-text-primary">{identifier}</span>
            </p>
            <form onSubmit={handleVerify} className="space-y-5">
              <OtpInput value={otp} onChange={setOtp} error={error} autoFocus />
              <Button type="submit" fullWidth variant="dark" loading={loading} disabled={otp.length < 6}>
                Verify & Sign In
              </Button>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('send'); setOtp(''); setError('') }}
                  className="text-[13px] text-text-secondary"
                >
                  Change {method === 'email' ? 'email' : 'number'}
                </button>
                {resendTimer > 0 ? (
                  <span className="text-[13px] text-text-tertiary flex items-center gap-1">
                    <RefreshCw size={12} /> Resend in {resendTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
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

        {/* ── Password ── */}
        {step === 'password' && (
          <>
            <h2 className="text-[20px] font-bold text-text-primary mb-1">Password login</h2>
            <p className="text-[14px] text-text-secondary mb-6">Enter your email and password</p>
            <form onSubmit={handlePassword} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={16} />}
                required
                autoFocus
              />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<KeyRound size={16} />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-1">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                error={error}
                required
              />
              <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
                Sign In
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('send'); setError('') }}
                  className="text-[13px] text-text-secondary"
                >
                  Use code instead
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('forgot'); setError('') }}
                  className="text-[13px] text-info"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Forgot password ── */}
        {step === 'forgot' && (
          <>
            <h2 className="text-[20px] font-bold text-text-primary mb-1">Reset password</h2>
            <p className="text-[14px] text-text-secondary mb-6">
              Enter your email and we'll send a reset link
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={16} />}
                error={error}
                required
                autoFocus
              />
              <Button type="submit" fullWidth variant="dark" loading={loading} rightIcon={<ArrowRight size={16} />}>
                Send Reset Link
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setStep('password'); setError('') }} className="text-[13px] text-info">
                Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ── Forgot password: sent ── */}
        {step === 'forgot-sent' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-success-light rounded-full flex items-center justify-center mx-auto">
              <Mail size={24} className="text-success" />
            </div>
            <div>
              <p className="text-[18px] font-bold text-text-primary">Check your inbox</p>
              <p className="text-[13px] text-text-secondary mt-1">
                A reset link was sent to{' '}
                <span className="font-semibold text-text-primary">{email}</span>
              </p>
            </div>
            <button type="button" onClick={() => { setStep('password'); setError('') }} className="text-[13px] text-info font-semibold">
              Back to sign in
            </button>
          </div>
        )}

      </div>

      <p className="text-[13px] text-text-tertiary mt-6">
        New here?{' '}
        <Link to="/signup" className="text-info font-semibold">Create account</Link>
      </p>
    </div>
  )
}
