import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'

// This page is the landing point for:
//  - Magic link clicks  (Supabase appends #access_token=… or ?code=… to this URL)
//  - Google OAuth redirects
//
// With detectSessionInUrl: true set in the Supabase client, the auth library
// automatically exchanges the token/code in the URL and fires onAuthStateChange
// with SIGNED_IN. The GuestGuard in the router then redirects to /dashboard,
// which lets OnboardingGuard send new users to /onboarding if needed.
// All we need to show here is a loading screen.

export default function AuthCallbackPage() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    // If nothing has happened after 10 s the link is probably expired or broken.
    const t = setTimeout(() => setSlow(true), 10_000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center px-5">
      <div className="text-center space-y-4">
        <Spinner size="lg" />
        {slow ? (
          <>
            <p className="text-[15px] font-semibold text-text-primary">
              This is taking longer than expected
            </p>
            <p className="text-[13px] text-text-secondary">
              The link may have expired or already been used.
            </p>
            <Link to="/login" className="text-info text-[14px] font-semibold">
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-[14px] text-text-secondary">Signing you in…</p>
        )}
      </div>
    </div>
  )
}
