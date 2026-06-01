import { useRef } from 'react'
import type { KeyboardEvent, ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  autoFocus?: boolean
  length?: number
}

export function OtpInput({ value, onChange, error, autoFocus, length = 6 }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  // Normalise: always an array of exactly `length` single chars (or empty strings)
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  function focusBox(i: number) {
    refs.current[i]?.focus()
    refs.current[i]?.select()
  }

  function setDigit(index: number, char: string) {
    const arr = [...digits]
    arr[index] = char
    onChange(arr.join(''))
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, '')

    if (!cleaned) return // deletions handled by onKeyDown

    if (cleaned.length > 1) {
      // Multiple digits — fill boxes from this position (covers paste-into-box)
      const chars = cleaned.slice(0, length - index)
      const arr = [...digits]
      for (let i = 0; i < chars.length; i++) arr[index + i] = chars[i]
      onChange(arr.join(''))
      focusBox(Math.min(index + chars.length, length - 1))
      return
    }

    // Single digit typed
    setDigit(index, cleaned)
    if (index < length - 1) focusBox(index + 1)
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        setDigit(index, '')
      } else if (index > 0) {
        setDigit(index - 1, '')
        focusBox(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusBox(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusBox(index + 1)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted.padEnd(length, value.slice(pasted.length)).slice(0, length))
    focusBox(Math.min(pasted.length, length - 1))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2.5 justify-center">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            type="tel"
            inputMode="numeric"
            maxLength={2}
            value={digit}
            autoFocus={autoFocus && i === 0}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={() => refs.current[i]?.select()}
            className={cn(
              'w-11 h-14 text-center text-[24px] font-bold rounded-[12px] border-2',
              'bg-surface-raised focus:outline-none transition-all duration-150 caret-transparent',
              error
                ? 'border-danger text-danger bg-danger-light'
                : digit
                  ? 'border-primary text-primary bg-primary-light'
                  : 'border-border text-text-primary focus:border-primary focus:bg-primary-light/30'
            )}
          />
        ))}
      </div>
      {error && (
        <p className="text-[12px] text-danger text-center">{error}</p>
      )}
    </div>
  )
}
