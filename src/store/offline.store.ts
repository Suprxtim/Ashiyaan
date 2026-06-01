import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PendingMutation {
  id: string
  type: 'mess_optout' | 'complaint' | 'profile_update'
  payload: Record<string, unknown>
  createdAt: string
  retries: number
}

interface OfflineState {
  isOnline: boolean
  pendingMutations: PendingMutation[]
  setOnline: (online: boolean) => void
  addMutation: (mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'retries'>) => void
  removeMutation: (id: string) => void
  incrementRetry: (id: string) => void
  clearAll: () => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      pendingMutations: [],
      setOnline: (isOnline) => set({ isOnline }),
      addMutation: (mutation) =>
        set((state) => ({
          pendingMutations: [
            ...state.pendingMutations,
            {
              ...mutation,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              retries: 0,
            },
          ],
        })),
      removeMutation: (id) =>
        set((state) => ({
          pendingMutations: state.pendingMutations.filter((m) => m.id !== id),
        })),
      incrementRetry: (id) =>
        set((state) => ({
          pendingMutations: state.pendingMutations.map((m) =>
            m.id === id ? { ...m, retries: m.retries + 1 } : m
          ),
        })),
      clearAll: () => set({ pendingMutations: [] }),
    }),
    { name: 'ashiyaan-offline' }
  )
)
