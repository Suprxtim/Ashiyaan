import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: number
  className?: string
}

export function StarRating({ value, onChange, size = 18, className }: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={!onChange ? 'pointer-events-none' : 'active:scale-90 transition-transform'}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={n <= Math.round(value) ? 'fill-accent text-accent' : 'fill-none text-text-tertiary'}
          />
        </button>
      ))}
    </div>
  )
}
