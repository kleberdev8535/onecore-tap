import type { ComponentPropsWithoutRef } from 'react'
import { Tabs as Primitive } from 'radix-ui'
import { cn } from '@/utils/cn'

export const Tabs = Primitive.Root
export const TabsContent = Primitive.Content

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn(
        '-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        'relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 data-[state=active]:border-brand data-[state=active]:text-fg [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}
