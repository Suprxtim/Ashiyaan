import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { useOnline } from '@/hooks/useOnline'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from '../shared/OfflineBanner'

// Generates a 6-beep two-tone alarm via Web Audio API
function playAlarm() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 6; i++) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.value = i % 2 === 0 ? 880 : 1100
      const t = ctx.currentTime + i * 0.3
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.start(t)
      osc.stop(t + 0.26)
    }
    setTimeout(() => ctx.close(), 2200)
  } catch {
    // Browser blocked audio (autoplay policy) — notification toast still shows
  }
}

function ManagerSosAlarm() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const user      = useAuthStore((s) => s.user)
  const isManager = user?.profile.role === 'warden' || user?.profile.role === 'manager'
  const hostelId  = user?.profile.hostel_id ?? ''

  useEffect(() => {
    if (!isManager || !hostelId) return

    const channel = supabase
      .channel(`sos-alarm:${hostelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_incidents', filter: `hostel_id=eq.${hostelId}` },
        () => {
          playAlarm()
          toast.error('🚨 SOS Alert — A resident needs help immediately!', {
            duration: 30_000,
            action: { label: 'View', onClick: () => navigate('/manager/sos') },
          })
          qc.invalidateQueries({ queryKey: ['sos-incidents', hostelId] })
          qc.invalidateQueries({ queryKey: ['manager-stats',  hostelId] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isManager, hostelId, navigate, qc])

  return null
}

export function AppShell() {
  const isOnline = useOnline()

  return (
    <div className="min-h-dvh bg-canvas flex">

      {/* Global SOS alarm — renders nothing, only subscribes for managers */}
      <ManagerSosAlarm />

      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-60">
        {!isOnline && <OfflineBanner />}

        {/* Page content */}
        <main className="flex-1 w-full max-w-[480px] mx-auto md:max-w-3xl md:px-6 md:py-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav — hidden on desktop */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
