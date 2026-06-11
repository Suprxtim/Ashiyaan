import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-btn transition-all active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none'

const variants: Record<Variant, string> = {
  primary:   'bg-accent text-text-on-accent hover:bg-accent-dark shadow-sm',
  dark:      'bg-primary text-white hover:bg-primary-mid shadow-sm',
  secondary: 'bg-transparent border-[1.5px] border-primary text-primary hover:bg-primary-light',
  ghost:     'bg-transparent text-text-secondary hover:bg-surface-raised',
  danger:    'bg-danger text-white hover:bg-red-700 shadow-sm',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-12 px-6 text-[15px]',
  lg: 'h-14 px-8 text-[16px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" color={variant === 'primary' ? 'dark' : 'white'} />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  )
)
Button.displayName = 'Button'
