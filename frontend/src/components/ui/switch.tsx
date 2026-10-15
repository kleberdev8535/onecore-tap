import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Switch as Primitive } from 'radix-ui'
import { cn } from '@/utils/cn'

/** Interruptor acessível (role="switch"); o estado também deve ser descrito em texto próximo. */
export const Switch = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Primitive.Root>>(
  ({ className, ...props }, ref) => (
    <Primitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-line-strong transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand',
        className,
      )}
      {...props}
    >
      <Primitive.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-white shadow-xs transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </Primitive.Root>
  ),
)
Switch.displayName = 'Switch'
