import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-warning text-white flex items-center justify-center gap-2 py-2 px-4 text-[13px] font-medium max-w-[480px] mx-auto">
      <WifiOff size={14} />
      <span>You're offline — changes will sync when reconnected</span>
    </div>
  )
}
