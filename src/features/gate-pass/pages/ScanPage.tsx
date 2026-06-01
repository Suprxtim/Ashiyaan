import { QRScanner } from '../components/QRScanner'
import { TopBar } from '@/components/layout/TopBar'

export default function ScanPage() {
  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Scan Gate Pass" showBack />
      <div className="pt-16 px-4">
        <QRScanner />
      </div>
    </div>
  )
}
