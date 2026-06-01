import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
import type { AuthUser } from '@/types/app.types'

interface AuthState {
  session: Session | null
  user: AuthUser | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoading: true,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      clear: () => set({ session: null, user: null, isLoading: false }),
    }),
    {
      name: 'ashiyaan-auth',
      partialize: (state) => ({ session: state.session, user: state.user }),
      // After rehydration: if we already have a session (even without the full user
      // profile), clear the loading flag so guards don't spin forever.
      // The useAuth effect will still refresh the profile in the background.
      onRehydrateStorage: () => (state) => {
        if (state && state.session) state.isLoading = false
      },
    }
  )
)
