import { cn } from '@/lib/utils'

type Variant =
  | 'submitted' | 'in_progress' | 'resolved' | 'closed' | 'rejected'
  | 'paid' | 'pending' | 'overdue'
  | 'active' | 'expired' | 'used'
  | 'urgent' | 'high' | 'medium' | 'low'
  | 'emergency' | 'general' | 'event' | 'rule' | 'maintenance'
  | 'default'

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

const variants: Record<Variant, string> = {
  submitted:   'bg-info-light text-info',
  in_progress: 'bg-warning-light text-warning',
  resolved:    'bg-success-light text-success',
  closed:      'bg-surface-raised text-text-secondary',
  rejected:    'bg-danger-light text-danger',
  paid:        'bg-success-light text-success',
  pending:     'bg-warning-light text-warning',
  overdue:     'bg-danger-light text-danger',
  active:      'bg-primary-light text-primary',
  expired:     'bg-surface-raised text-text-tertiary',
  used:        'bg-surface-raised text-text-tertiary',
  urgent:      'bg-danger-light text-danger',
  high:        'bg-warning-light text-warning',
  medium:      'bg-info-light text-info',
  low:         'bg-surface-raised text-text-secondary',
  emergency:   'bg-danger-light text-danger',
  general:     'bg-surface-raised text-text-secondary',
  event:       'bg-primary-light text-primary',
  rule:        'bg-warning-light text-warning',
  maintenance: 'bg-info-light text-info',
  default:     'bg-surface-raised text-text-secondary',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-semibold uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
