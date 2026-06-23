import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { cn } from '@/lib/utils'

interface QRScannerProps {
  active: boolean
  onScan: (token: string) => void
  onError?: (message: string) => void
}

export function QRScanner({ active, onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (active && !started) {
      const qr = new Html5Qrcode('qr-reader')
      scannerRef.current = qr
      qr.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (token) => { onScan(token) },
        () => {},
      ).then(() => setStarted(true))
        .catch(() => {
          onError?.('Camera access denied. Please allow camera permission and try again.')
        })
    }
    if (!active && started) {
      scannerRef.current?.stop().catch(() => {})
      setStarted(false)
    }
  }, [active, started, onScan, onError])

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}) }
  }, [])

  return (
    <div className="relative w-full max-w-sm">
      <div id="qr-reader" className={cn('w-full rounded-card overflow-hidden bg-black', started ? 'h-72' : 'h-0')} />
      {started && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-52 h-52 relative">
            {(['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const).map((pos, i) => (
              <div key={i} className={`absolute w-8 h-8 border-primary border-[3px] ${pos} ${
                i === 0 ? 'rounded-tl-sm border-r-0 border-b-0' :
                i === 1 ? 'rounded-tr-sm border-l-0 border-b-0' :
                i === 2 ? 'rounded-bl-sm border-r-0 border-t-0' :
                           'rounded-br-sm border-l-0 border-t-0'}`} />
            ))}
            <div className="absolute left-2 right-2 h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
    </div>
  )
}
