import { cn } from '@/utils/cn'

/** Simbolo OneCore Tap: ponto de contato (verde) emitindo ondas de aproximacao. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill={inverted ? '#FFFFFF' : '#0B0F0E'} />
      <circle cx="13" cy="16" r="3.2" fill="#16A36B" />
      <path
        d="M18 10.5a7.8 7.8 0 0 1 0 11M21.5 7.5a12 12 0 0 1 0 17"
        fill="none"
        stroke={inverted ? '#0B0F0E' : '#FFFFFF'}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface LogoProps {
  className?: string
  /** Para fundos escuros. */
  inverted?: boolean
  showWordmark?: boolean
}

export function Logo({ className, inverted = false, showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark inverted={inverted} />
      {showWordmark && (
        <span className={cn('text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-fg')}>
          OneCore <span className="text-brand">Tap</span>
        </span>
      )}
    </span>
  )
}
