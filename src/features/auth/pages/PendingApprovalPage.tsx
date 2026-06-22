import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, XCircle, Hash, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@/types/app.types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type PageStatus = 'pending' | 'rejected'

export default function PendingApprovalPage() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const setUser  = useAuthStore((s) => s.setUser)

  const [status,     setStatus]     = useState<PageStatus>('pending')
  const [retryCode,  setRetryCode]  = useState('')
  const [retryError, setRetryError] = useState('')
  const [loading,    setLoading]    = useState(false)

  const hostelName = user?.hostel?.name ?? 'your warden'

  // Fetches the latest profile from DB and updates the auth store.
  // Returns the updated AuthUser, or null if the fetch failed.
  async function refreshAndSet(userId: string): Promise<AuthUser | null> {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, hostels(*)')
      .eq('id', userId)
      .single()
    if (!profile) return null
    const updated: AuthUser = {
      id:      authUser.id,
      email:   authUser.email,
      profile: profile as AuthUser['profile'],
      hostel:  (profile as unknown as { hostels: AuthUser['hostel'] }).hostels ?? null,
    }
    setUser(updated)
    return updated
  }

  useEffect(() => {
    if (!user) return
    const userId = user.id

    // Realtime subscription — fires immediately when the manager approves/rejects
    const channel = supabase
      .channel(`pending-approval-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'profiles',
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          const updated = payload.new as { is_active: boolean; hostel_id: string | null }
          if (updated.is_active) {
            await refreshAndSet(userId)
            toast.success("You've been approved! Welcome!")
            navigate('/dashboard')
          } else if (!updated.hostel_id) {
            await refreshAndSet(userId)
            setStatus('rejected')
          }
        }
      )
      .subscribe()

    // Polling fallback every 10 seconds in case realtime is unavailable
    const poll = setInterval(async () => {
      const latest = await refreshAndSet(userId)
      if (!latest) return
      if (latest.profile.is_active) {
        clearInterval(poll)
        toast.success("You've been approved! Welcome!")
        navigate('/dashboard')
      } else if (!latest.profile.hostel_id) {
        clearInterval(poll)
        setStatus('rejected')
      }
    }, 10_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRetry(e: React.FormEvent) {
    e.preventDefault()
    setRetryError('')
    setLoading(true)

    const { data, error: rpcErr } = await supabase
      .rpc('join_hostel_by_code', { p_code: retryCode.toUpperCase().trim() })

    if (rpcErr) {
      setRetryError(rpcErr.message.includes('Invalid code')
        ? 'Invalid code — double check with your warden.'
        : rpcErr.message)
      setLoading(false)
      return
    }

    if (!user) { setLoading(false); return }
    const updated = await refreshAndSet(user.id)
    setLoading(false)

    if (!updated) {
      setRetryError('Joined, but profile failed to load. Please refresh.')
      return
    }

    const result = data as { name: string }
    toast.success(`Request sent to ${result.name}!`)
    setStatus('pending')
    setRetryCode('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    useAuthStore.getState().clear()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 py-10">

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-primary rounded-[18px] flex items-center justify-center mx-auto mb-3 shadow-raised">
          <span className="text-white text-xl font-black">A</span>
        </div>
        <h1 className="text-[22px] font-bold text-text-primary">Ashiyaan</h1>
      </div>

      <div className="w-full max-w-sm space-y-4">

        {status === 'pending' ? (
          <div className="bg-surface rounded-card shadow-card p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-warning-light rounded-full flex items-center justify-center mx-auto">
              <Clock size={32} className="text-warning" />
            </div>
            <div>
              <p className="text-[20px] font-bold text-text-primary">Waiting for approval</p>
              <p className="text-[13px] text-text-secondary mt-1">
                Your request has been sent to{' '}
                <span className="font-semibold text-text-primary">{hostelName}</span>.
                The warden will approve or reject your request shortly.
              </p>
            </div>
            <div className="bg-canvas rounded-inner px-4 py-3">
              <p className="text-[12px] text-text-tertiary">
                You'll be let in as soon as your warden approves. This page checks automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-card shadow-card p-6 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-danger-light rounded-full flex items-center justify-center mx-auto">
                <XCircle size={32} className="text-danger" />
              </div>
              <div>
                <p className="text-[20px] font-bold text-text-primary">Request not approved</p>
                <p className="text-[13px] text-text-secondary mt-1">
                  Your request was rejected. Try a different code or contact your warden.
                </p>
              </div>
            </div>
            <form onSubmit={handleRetry} className="space-y-3">
              <Input
                label="Place code"
                placeholder="e.g. SUN-281"
                value={retryCode}
                onChange={(e) => setRetryCode(e.target.value.toUpperCase())}
                leftIcon={<Hash size={16} />}
                required
                autoFocus
              />
              {retryError && (
                <div className="bg-danger-light rounded-inner px-3 py-2">
                  <p className="text-[13px] text-danger">{retryError}</p>
                </div>
              )}
              <Button type="submit" fullWidth variant="dark" loading={loading}>
                Try Again
              </Button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="text-[12px] text-text-secondary flex items-center gap-1.5 mx-auto hover:text-danger transition-colors"
        >
          <LogOut size={12} /> Log out
        </button>

      </div>
    </div>
  )
}
