import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@/types/app.types'

export function useAuth() {
  const { setSession, setUser, setLoading, clear } = useAuthStore()

  async function signOut() {
    await supabase.auth.signOut()
    clear()
  }

  useEffect(() => {
    // Supabase v2 fires INITIAL_SESSION synchronously when onAuthStateChange is
    // registered, covering the same data that getSession() would return.
    // Using both causes loadProfile to run twice in parallel — so we use only this.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        clear()
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(userId: string) {
    // Only show the full-screen spinner when we have no cached user yet.
    // Returning users get a silent background refresh.
    const needsLoader = !useAuthStore.getState().user
    if (needsLoader) setLoading(true)

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, hostels(*)')
        .eq('id', userId)
        .single()

      // Guard against the sign-out race: if the user signed out while this fetch
      // was in flight, the session will be null — don't restore stale user data.
      const currentSession = useAuthStore.getState().session
      if (profile && currentSession?.user.id === userId) {
        const authUser: AuthUser = {
          id: userId,
          email: currentSession.user.email,
          profile: profile as AuthUser['profile'],
          hostel: (profile as unknown as { hostels: AuthUser['hostel'] }).hostels ?? null,
        }
        setUser(authUser)
      }
    } catch (err) {
      console.error('[useAuth] loadProfile failed:', err)
    } finally {
      // Only clear the flag we actually set — don't accidentally cancel a
      // loading state owned by a concurrent call.
      if (needsLoader) setLoading(false)
    }
  }

  return { signOut }
}
