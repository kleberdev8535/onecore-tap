import type { ReactNode } from 'react'
import { Dialog as Primitive } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/** Modal acessivel (foco preso, Esc fecha, titulo anunciado) com entrada suave. */
export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Primitive.Portal forceMount>
            <Primitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Primitive.Overlay>
            <Primitive.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-line bg-surface shadow-pop focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                  <div>
                    <Primitive.Title className="text-base font-semibold tracking-tight text-fg">{title}</Primitive.Title>
                    {description ? (
                      <Primitive.Description className="mt-1 text-sm text-muted">{description}</Primitive.Description>
                    ) : (
                      <Primitive.Description className="sr-only">{title}</Primitive.Description>
                    )}
                  </div>
                  <Primitive.Close
                    className="-mr-2 -mt-1 flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-fg"
                    aria-label="Fechar"
                  >
                    <X className="size-4" />
                  </Primitive.Close>
                </div>
                <div className="overflow-y-auto px-6 py-5">{children}</div>
                {footer && (
                  <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-muted/60 px-6 py-4 sm:flex-row sm:justify-end sm:rounded-b-2xl">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Primitive.Content>
          </Primitive.Portal>
        )}
      </AnimatePresence>
    </Primitive.Root>
  )
}
