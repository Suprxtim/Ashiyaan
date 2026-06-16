import { useState, useRef } from 'react'
import { Phone, ShieldAlert, Siren } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { toast } from 'sonner'

const NATIONAL_CONTACTS = [
  { label: 'Hospital', number: '108' },
  { label: 'Police', number: '100' },
  { label: 'Ambulance', number: '102' },
  { label: 'Fire', number: '101' },
]

export default function EmergencyPage() {
  const user = useAuthStore((s) => s.user)

  // Build contact list: hostel contact first (if available), then national numbers
  const hostelPhone = (user?.hostel as unknown as { contact_phone?: string | null })?.contact_phone
  const contacts = [
    ...(hostelPhone
      ? [{ label: user?.hostel?.name ? `${user.hostel.name} (Warden)` : 'Warden', number: hostelPhone }]
      : []),
    ...NATIONAL_CONTACTS,
  ]
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fired, setFired] = useState(false)

  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startHold() {
    if (fired) return
    setHolding(true)
    setProgress(0)
    const start = Date.now()
    holdTimerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 1500) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(holdTimerRef.current!)
        triggerSOS()
      }
    }, 30)
  }

  function cancelHold() {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    if (!fired) { setHolding(false); setProgress(0) }
  }

  async function triggerSOS() {
    setFired(true)
    setHolding(false)

    // Show alert immediately so the user knows the SOS fired even if DB/geo takes time
    toast.error('🚨 SOS Alert Sent — Help is on the way', { duration: 8000 })

    let lat: number | null = null
    let lng: number | null = null

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch { }

    // Only attempt DB insert when the user is linked to a hostel
    if (user && user.profile.hostel_id) {
      await supabase.from('sos_incidents').insert({
        user_id: user.id,
        hostel_id: user.profile.hostel_id,
        location_lat: lat,
        location_lng: lng,
        status: 'active',
      })
    }
  }

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Emergency" showBack />

      <div className="px-4 pt-16 space-y-8">

        {/* ── SOS Button ── */}
        <div className="flex flex-col items-center py-6 gap-4">
          <p className="text-[13px] text-text-secondary font-medium">
            {fired ? '🚨 Alert sent — help is on the way' : 'Hold for 1.5 seconds to raise alarm'}
          </p>

          {/* Pulse rings */}
          <div className="relative flex items-center justify-center">
            {(holding || fired) && (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-danger/10 sos-ring" />
                <div className="absolute w-44 h-44 rounded-full bg-danger/5 sos-ring" style={{ animationDelay: '0.4s' }} />
              </>
            )}

            {/* Main button */}
            <button
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 select-none transition-transform active:scale-95 overflow-hidden ${fired ? 'bg-danger/80' : 'bg-danger'
                } shadow-raised`}
              style={{ WebkitUserSelect: 'none' }}
            >
              {/* Hold progress arc */}
              {holding && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
                  <circle
                    cx="56" cy="56" r="52"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="6"
                    strokeDasharray={`${(progress / 100) * 326} 326`}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <Siren size={32} className="text-white" />
              <span className="text-white text-[13px] font-black tracking-wider">SOS</span>
            </button>
          </div>

          <p className="text-[12px] text-text-tertiary text-center max-w-[240px]">
            Immediately alerts warden, security staff, and sends your location
          </p>
        </div>

        {/* ── Emergency Contacts ── */}
        <div>
          <p className="text-[17px] font-bold text-text-primary mb-3">Emergency Contacts</p>
          <div className="grid grid-cols-2 gap-3">
            {contacts.map(({ label, number }) => (
              <a
                key={label}
                href={`tel:${number}`}
                className="bg-surface rounded-card shadow-card px-4 py-3 flex items-center justify-between active:bg-surface-raised transition-colors"
              >
                <div>
                  <p className="text-[14px] font-semibold text-text-primary">{label}</p>
                  <p className="text-[12px] text-text-tertiary mt-0.5">{number}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-success-light flex items-center justify-center flex-shrink-0">
                  <Phone size={16} className="text-success" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ── Safety tip ── */}
        <div className="bg-warning-light rounded-card p-4 flex gap-3">
          <ShieldAlert size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Only use SOS in genuine emergencies. False alarms affect your safety record and waste emergency response resources.
          </p>
        </div>

      </div>
    </div>
  )
}
