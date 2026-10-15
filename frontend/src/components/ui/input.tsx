import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icone a esquerda (Lucide), decorativo. */
  leading?: ReactNode
  /** Elemento interativo a direita (ex.: mostrar senha). */
  trailing?: ReactNode
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leading, trailing, invalid, ...props }, ref) => (
    <div className="relative flex items-center">
      {leading && (
        <span className="pointer-events-none absolute left-3 flex text-muted [&_svg]:size-4" aria-hidden>
          {leading}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-10 w-full rounded-md border border-line bg-surface px-3 text-[15px] text-fg shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted/80 hover:border-line-strong focus-visible:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted sm:text-sm',
          leading && 'pl-9',
          trailing && 'pr-11',
          invalid && 'border-danger focus-visible:border-danger focus-visible:shadow-[0_0_0_4px_rgb(196_50_10/0.14)]',
          className,
        )}
        {...props}
      />
      {trailing && <span className="absolute right-1 flex">{trailing}</span>}
    </div>
  ),
)
Input.displayName = 'Input'
