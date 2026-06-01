import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { CheckCircle2, XCircle, ScanLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'

type ScanResult = {
  status: 'success' | 'already_used' | 'expired' | 'invalid'
  studentName?: string
  roomNumber?:  string
  passType?:    string
}

export function QRScanner() {
  const scannerRef  = useRef<Html5Qrcode | null>(null)
  const user        = useAuthStore((s) => s.user)
  const [scanning,  setScanning]  = useState(false)
  const [result,    setResult]    = useState<ScanResult | null>(null)
  const [error,     setError]     = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  async function startScan() {
    setResult(null); setError('')
    const qr = new Html5Qrcode('qr-reader')
    scannerRef.current = qr
    setScanning(true)

    try {
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}   // ignore frame errors
      )
    } catch {
      setError('Camera access denied. Please allow camera permission and try again.')
      setScanning(false)
    }
  }

  async function stopScan() {
    await scannerRef.current?.stop().catch(() => {})
    setScanning(false)
  }

  async function onScanSuccess(token: string) {
    if (processing) return
    setProcessing(true)
    await stopScan()

    // Look up the pass by token
    const { data: pass, error: passErr } = await supabase
      .from('gate_passes')
      .select('*, profiles(full_name, room_number)')
      .eq('qr_token', token)
      .maybeSingle()

    if (passErr || !pass) {
      setResult({ status: 'invalid' })
      setProcessing(false)
      return
    }

    const profile = (pass as unknown as { profiles: { full_name: string; room_number: string | null } }).profiles

    if (pass.status === 'used') {
      setResult({ status: 'already_used', studentName: profile?.full_name, passType: pass.pass_type })
      setProcessing(false)
      return
    }

    if (pass.status === 'expired' || new Date(pass.expires_at) < new Date()) {
      await supabase.from('gate_passes').update({ status: 'expired' }).eq('id', pass.id)
      setResult({ status: 'expired', studentName: profile?.full_name, passType: pass.pass_type })
      setProcessing(false)
      return
    }

    // Mark as used
    await supabase
      .from('gate_passes')
      .update({ status: 'used', scanned_at: new Date().toISOString(), scanned_by: user?.id })
      .eq('id', pass.id)

    setResult({
      status:      'success',
      studentName: profile?.full_name,
      roomNumber:  profile?.room_number ?? undefined,
      passType:    pass.pass_type,
    })
    setProcessing(false)
  }

  return (
    <div className="flex flex-col items-center gap-5">

      {/* Camera viewport */}
      <div className="relative w-full max-w-sm">
        <div
          id="qr-reader"
          className={cn(
            'w-full rounded-card overflow-hidden bg-black',
            scanning ? 'h-72' : 'h-0'
          )}
        />

        {/* Scan frame overlay */}
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 relative">
              {/* Corner markers */}
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                <div key={i} className={`absolute w-8 h-8 border-primary border-[3px] ${pos} ${
                  i === 0 ? 'rounded-tl-sm border-r-0 border-b-0' :
                  i === 1 ? 'rounded-tr-sm border-l-0 border-b-0' :
                  i === 2 ? 'rounded-bl-sm border-r-0 border-t-0' :
                             'rounded-br-sm border-l-0 border-t-0'
                }`} />
              ))}
              {/* Scan line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}
      </div>

      {/* Idle state */}
      {!scanning && !result && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center">
            <ScanLine size={36} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-text-primary">Scan Gate Pass</p>
            <p className="text-[13px] text-text-secondary mt-1">
              Point camera at student's QR code
            </p>
          </div>
          {error && (
            <div className="bg-danger-light rounded-inner px-4 py-2 max-w-xs text-center">
              <p className="text-[13px] text-danger">{error}</p>
            </div>
          )}
          <button
            onClick={startScan}
            className="bg-primary text-white px-8 py-3 rounded-btn font-semibold text-[15px] active:scale-95 transition-transform"
          >
            Start Scanning
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={cn(
          'w-full max-w-sm rounded-card p-5 space-y-3',
          result.status === 'success' ? 'bg-success-light' : 'bg-danger-light'
        )}>
          <div className="flex items-center gap-3">
            {result.status === 'success'
              ? <CheckCircle2 size={28} className="text-success flex-shrink-0" />
              : <XCircle     size={28} className="text-danger flex-shrink-0" />}
            <div>
              <p className={`text-[17px] font-bold ${result.status === 'success' ? 'text-success' : 'text-danger'}`}>
                {result.status === 'success'    ? 'Access Granted'  :
                 result.status === 'already_used' ? 'Already Used'  :
                 result.status === 'expired'    ? 'Pass Expired'    :
                                                   'Invalid Pass'}
              </p>
              {result.studentName && (
                <p className="text-[14px] text-text-primary font-semibold">{result.studentName}</p>
              )}
            </div>
          </div>

          {result.status === 'success' && (
            <div className="flex gap-3">
              {result.roomNumber && (
                <div className="bg-white/60 rounded-inner px-3 py-2 flex-1 text-center">
                  <p className="text-[11px] text-text-tertiary">Room</p>
                  <p className="text-[14px] font-bold text-text-primary">{result.roomNumber}</p>
                </div>
              )}
              <div className="bg-white/60 rounded-inner px-3 py-2 flex-1 text-center">
                <p className="text-[11px] text-text-tertiary">Type</p>
                <p className="text-[14px] font-bold text-text-primary capitalize">{result.passType}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => { setResult(null); setError('') }}
            className="w-full bg-white/80 rounded-btn py-2.5 text-[14px] font-semibold text-text-primary"
          >
            Scan Next
          </button>
        </div>
      )}

      {scanning && (
        <button onClick={stopScan} className="text-[13px] text-danger font-semibold">
          Cancel
        </button>
      )}
    </div>
  )
}
