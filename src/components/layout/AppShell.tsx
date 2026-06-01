import { Outlet } from 'react-router-dom'
import { useOnline } from '@/hooks/useOnline'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from '../shared/OfflineBanner'

export function AppShell() {
  const isOnline = useOnline()

  return (
    <div className="min-h-dvh bg-canvas flex">

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
