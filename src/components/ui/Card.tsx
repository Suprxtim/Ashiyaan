import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'alert' | 'warning' | 'success' | 'flat'

interface CardProps {
  variant?: CardVariant
  children: React.ReactNode
  className?: string
  onClick?: () => void
  padding?: boolean
}

const variants: Record<CardVariant, string> = {
  default: 'bg-surface shadow-card',
  alert:   'bg-danger-light border-l-4 border-danger shadow-card',
  warning: 'bg-warning-light border-l-4 border-warning shadow-card',
  success: 'bg-success-light border-l-4 border-success shadow-card',
  flat:    'bg-surface border border-border',
}

export function Card({ variant = 'default', children, className, onClick, padding = true }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-card',
        padding && 'p-4',
        variants[variant],
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
        className
      )}
    >
      {children}
    </div>
  )
}
