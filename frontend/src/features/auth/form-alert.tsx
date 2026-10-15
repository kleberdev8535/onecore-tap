import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { cn } from '@/utils/cn'

interface FormAlertProps {
  message?: string | null
  tone?: 'danger' | 'success'
}

export function FormAlert({ message, tone = 'danger' }: FormAlertProps) {
  const Icon = tone === 'danger' ? CircleAlert : CircleCheck
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          role={tone === 'danger' ? 'alert' : 'status'}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'mb-5 flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
              tone === 'danger'
                ? 'border-danger/20 bg-danger-soft text-danger'
                : 'border-success/20 bg-success-soft text-success',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="leading-relaxed">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
