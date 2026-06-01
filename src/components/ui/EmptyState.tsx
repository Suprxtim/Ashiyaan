import { cn } from '@/lib/utils'
import { Button } from './Button'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6 gap-4', className)}>
      <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[16px] font-bold text-text-primary">{title}</p>
        {description && <p className="text-[14px] text-text-secondary">{description}</p>}
      </div>
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
