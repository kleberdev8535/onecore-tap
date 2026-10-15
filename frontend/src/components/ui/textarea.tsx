import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[15px] text-fg shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-muted/80 hover:border-line-strong focus-visible:border-brand focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none sm:text-sm',
        invalid && 'border-danger',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
