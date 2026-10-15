import { useId, type ReactElement, type ReactNode, cloneElement } from 'react'
import { CircleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/utils/cn'

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  labelAside?: ReactNode
  className?: string
  /** Um unico controle (Input, select...). Recebe id, aria-invalid e aria-describedby automaticamente. */
  children: ReactElement<Record<string, unknown>>
}

/** Label sempre visivel + mensagem de erro anunciada a leitores de tela. */
export function Field({ label, error, hint, labelAside, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-fg-secondary">
          {label}
        </label>
        {labelAside}
      </div>
      {cloneElement(children, { id, invalid: Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 text-xs font-medium text-danger"
          >
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
