import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { generatePass, getActivePass, getPassHistory, expirePass } from '@/services/gatePass.service'
import type { Database } from '@/types/database.types'

type PassType = Database['public']['Enums']['pass_type']

export function useGatePass() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  const { data: activePass, isLoading: passLoading } = useQuery({
    queryKey: ['active-pass', userId],
    queryFn:  () => getActivePass(userId),
    enabled:  !!userId,
    refetchInterval: 15_000,
  })

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['pass-history', userId],
    queryFn:  () => getPassHistory(userId),
    enabled:  !!userId,
  })

  // Countdown timer
  useEffect(() => {
    if (!activePass) { setSecondsLeft(0); return }

    function tick() {
      const remaining = Math.max(
        0,
        Math.floor((new Date(activePass!.expires_at).getTime() - Date.now()) / 1000)
      )
      setSecondsLeft(remaining)
      if (remaining === 0) {
        expirePass(activePass!.id)
        qc.invalidateQueries({ queryKey: ['active-pass', userId] })
        qc.invalidateQueries({ queryKey: ['pass-history', userId] })
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activePass, userId, qc])

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: (type: PassType) => generatePass(userId, hostelId, type),
    onSuccess: () => {
      toast.success('Pass generated — valid for 5 minutes')
      qc.invalidateQueries({ queryKey: ['active-pass', userId] })
      qc.invalidateQueries({ queryKey: ['pass-history', userId] })
    },
    onError: (err: Error) => {
      console.error('[generatePass]', err)
      toast.error(`Failed to generate pass: ${err.message}`)
    },
  })

  const handleGenerate = useCallback((type: PassType) => {
    if (!userId) { toast.error('Not logged in'); return }
    if (!hostelId) { toast.error('Your profile is not linked to a hostel yet. Ask your warden for the hostel code.'); return }
    generate(type)
  }, [userId, hostelId, generate])

  return {
    activePass,
    passLoading,
    history,
    historyLoading,
    secondsLeft,
    generating,
    generate: handleGenerate,
    hostelLinked: !!hostelId,
  }
}
