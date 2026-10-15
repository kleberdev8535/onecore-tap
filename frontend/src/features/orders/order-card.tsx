import { memo } from 'react'
import { Clock, MoreHorizontal, Ban, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ApiError } from '@/services/http'
import type { OrderView } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'
import { useTransition } from './api'
import { canRun, DELAY_LATE, DELAY_WARNING, minutesSince, nextStep, statusMeta } from './order-meta'
import { orderNumber } from './order-format'
import { ItemsList, TestBadge } from './order-parts'

interface OrderCardProps {
  order: OrderView
  permissions: string[]
  now: number
  onOpen: (id: string) => void
  onCancel: (order: OrderView) => void
  onDragStart?: (order: OrderView) => void
  onDragEnd?: () => void
}

/**
 * Card do Kanban. Arrastar é um atalho no desktop; o botão do próximo passo e o menu são a alternativa acessível
 * (teclado, leitor de tela e toque) e fazem exatamente a mesma coisa.
 */
export const OrderCard = memo(function OrderCard({ order, permissions, now, onOpen, onCancel, onDragStart, onDragEnd }: OrderCardProps) {
  const transition = useTransition()
  const step = nextStep[order.status]
  const canStep = step && canRun(permissions, order.status, step.to)
  const canCancel = permissions.includes('ORDERS_MANAGE') && order.status !== 'COMPLETED' && order.status !== 'CANCELLED'
  const active = order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && order.status !== 'DELIVERED'
  const minutes = minutesSince(order.createdAt, now)
  const late = active && minutes >= DELAY_LATE
  const warning = active && !late && minutes >= DELAY_WARNING

  const advance = async () => {
    if (!step) return
    try {
      await transition.mutateAsync({ id: order.id, from: order.status, to: step.to })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível atualizar o pedido.')
    }
  }

  return (
    <article
      draggable={Boolean(canStep || canCancel)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', order.id)
        onDragStart?.(order)
      }}
      onDragEnd={onDragEnd}
      aria-label={`Pedido ${orderNumber(order.number)}, mesa ${order.tableLabel}, ${statusMeta[order.status].label}`}
      className={cn(
        'group rounded-xl border bg-surface p-3.5 shadow-card transition-shadow duration-150 hover:shadow-pop',
        (canStep || canCancel) && 'cursor-grab active:cursor-grabbing',
        late ? 'border-danger/40' : warning ? 'border-warning/40' : 'border-line',
        order.status === 'AWAITING_CONFIRMATION' && 'ring-1 ring-inset ring-warning/30',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onOpen(order.id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:underline">
          <p className="flex items-baseline gap-2">
            <span className="whitespace-nowrap text-[15px] font-semibold text-fg">Mesa {order.tableLabel}</span>
            <span className="text-xs font-medium text-muted tabular">{orderNumber(order.number)}</span>
          </p>
          {order.customerName && <p className="truncate text-[13px] text-muted">{order.customerName}</p>}
        </button>
        <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-0.5">
          <span className={cn('inline-flex items-center gap-1 text-xs tabular', late ? 'font-semibold text-danger' : warning ? 'font-medium text-warning' : 'text-muted')}>
            <Clock className="size-3" aria-hidden /> {minutes} min
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações do pedido ${orderNumber(order.number)}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onOpen(order.id)}><Eye aria-hidden /> Ver detalhes e histórico</DropdownMenuItem>
              {canCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onCancel(order)} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger"><Ban aria-hidden /> Cancelar pedido</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {(order.status === 'AWAITING_CONFIRMATION' || order.test) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {order.status === 'AWAITING_CONFIRMATION' && <Badge tone="warning" dot>A confirmar</Badge>}
          {order.test && <TestBadge />}
        </div>
      )}

      <div className="mt-3"><ItemsList items={order.items} /></div>
      {order.notes && <p className="mt-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning">{order.notes}</p>}
      {order.status === 'CANCELLED' && order.cancelReason && <p className="mt-2 text-xs text-danger">Motivo: {order.cancelReason}</p>}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-sm font-semibold text-fg tabular">{formatCents(order.totalCents)}</span>
        {canStep && step && (
          <Button size="sm" variant={order.status === 'AWAITING_CONFIRMATION' ? 'primary' : 'secondary'} loading={transition.isPending} onClick={advance}>
            {step.label}
          </Button>
        )}
      </footer>
    </article>
  )
})
