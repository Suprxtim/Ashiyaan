import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  circle?: boolean
  lines?: number
}

export function Skeleton({ className, circle, lines }: SkeletonProps) {
  if (lines) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn('skeleton h-4 rounded', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('skeleton', circle ? 'rounded-full' : 'rounded', className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-card p-4 shadow-card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton circle className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton lines={2} />
    </div>
  )
}
