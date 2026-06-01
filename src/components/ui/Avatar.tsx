import { cn } from '@/lib/utils'
import { getInitials, getAvatarColor } from '@/lib/utils'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
  online?: boolean
  className?: string
}

const sizes: Record<AvatarSize, { wrapper: string; text: string; dot: string }> = {
  sm: { wrapper: 'w-8 h-8',  text: 'text-[12px]', dot: 'w-2 h-2' },
  md: { wrapper: 'w-10 h-10', text: 'text-[14px]', dot: 'w-2.5 h-2.5' },
  lg: { wrapper: 'w-14 h-14', text: 'text-[18px]', dot: 'w-3 h-3' },
  xl: { wrapper: 'w-18 h-18', text: 'text-[24px]', dot: 'w-3.5 h-3.5' },
}

export function Avatar({ name, src, size = 'md', online, className }: AvatarProps) {
  const { wrapper, text, dot } = sizes[size]
  const color = getAvatarColor(name)
  const initials = getInitials(name)

  return (
    <div className={cn('relative flex-shrink-0', wrapper, className)}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div
          className={cn('w-full h-full rounded-full flex items-center justify-center text-white font-semibold', text)}
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-surface',
            dot,
            online ? 'bg-success' : 'bg-border'
          )}
        />
      )}
    </div>
  )
}
