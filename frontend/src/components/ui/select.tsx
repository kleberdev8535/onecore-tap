import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Select nativo estilizado: acessivel e com o seletor do sistema no celular. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-10 w-full appearance-none rounded-md border border-line bg-surface pl-3 pr-9 text-[15px] text-fg shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus-visible:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none sm:text-sm',
          invalid && 'border-danger',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  ),
)
Select.displayName = 'Select'
