import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg'
type Color = 'primary' | 'white' | 'dark'

interface SpinnerProps {
  size?: Size
  color?: Color
  className?: string
}

const sizes: Record<Size, string> = {
  sm: 'w-4 h-4 border-[2px]',
  md: 'w-6 h-6 border-[2.5px]',
  lg: 'w-8 h-8 border-[3px]',
}

const colors: Record<Color, string> = {
  primary: 'border-primary border-t-transparent',
  white:   'border-white border-t-transparent',
  dark:    'border-text-primary border-t-transparent',
}

export function Spinner({ size = 'md', color = 'primary', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('rounded-full animate-spin', sizes[size], colors[color], className)}
    />
  )
}
