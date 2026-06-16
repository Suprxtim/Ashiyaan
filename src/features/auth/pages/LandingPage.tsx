import { useNavigate } from 'react-router-dom'
import { QrCode, UtensilsCrossed, MessageSquare, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const FEATURES = [
  { Icon: QrCode,           title: 'Gate Pass',    desc: 'Generate QR codes to exit and re-enter your hostel' },
  { Icon: UtensilsCrossed,  title: 'Mess Opt-out', desc: 'Skip meals and stop being billed for ones you miss' },
  { Icon: MessageSquare,    title: 'Complaints',   desc: 'Raise and track issues directly with your warden' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Logo */}
        <div className="w-20 h-20 bg-primary rounded-[24px] flex items-center justify-center mb-4 shadow-raised">
          <span className="text-white text-3xl font-black">A</span>
        </div>
        <h1 className="text-[32px] font-black text-text-primary">Ashiyaan</h1>
        <p className="text-[15px] text-text-secondary mt-1 mb-10">Your hostel, smarter.</p>

        {/* Feature highlights */}
        <div className="w-full space-y-3 mb-10">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4 bg-surface rounded-card shadow-card px-4 py-3">
              <div className="w-10 h-10 bg-primary-light rounded-inner flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-text-primary">{title}</p>
                <p className="text-[12px] text-text-secondary leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="w-full space-y-3">
          <Button
            fullWidth
            variant="dark"
            size="lg"
            rightIcon={<ArrowRight size={18} />}
            onClick={() => navigate('/signup')}
          >
            Get Started
          </Button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-3 text-[14px] font-semibold text-text-secondary text-center"
          >
            I already have an account
          </button>
        </div>

      </div>
    </div>
  )
}
