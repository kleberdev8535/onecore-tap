import { useState } from 'react'
import { Bell, BellOff, FlaskConical, MessageSquareText, Receipt, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import type { OrderItemView, OrderView } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents, formatDateTime } from '@/utils/format'
import { useSession } from '@/features/auth/api'
import { RegisterPaymentDialog } from '@/features/finance/register-payment-dialog'
import { can } from '@/features/restaurant/navigation'
import { useOrderDetail, useTransition } from './api'
import { statusMeta } from './order-meta'
import { orderNumber } from './order-format'
import { unlockAudio, useRealtimeStore } from './realtime'

export function ItemsList({ items, large = false }: { items: OrderItemView[]; large?: boolean }) {
  return (
    <ul className={cn('flex flex-col', large ? 'gap-3' : 'gap-1.5')}>
      {items.map((item, i) => (
        <li key={i} className="min-w-0">
          <p className={cn('text-fg', large ? 'text-lg font-semibold leading-snug' : 'text-[13px] font-medium')}>
            <span className={cn('tabular', large ? 'mr-2 text-brand-700' : 'mr-1.5 text-muted')}>{item.quantity}x</span>
            {item.productName}
          </p>
          {item.options.length > 0 && (
            <p className={cn('text-fg-secondary', large ? 'mt-0.5 text-base' : 'text-xs')}>
              {item.options.map((o) => o.optionName).join(' · ')}
            </p>
          )}
          {item.notes && (
            <p className={cn('mt-0.5 flex items-start gap-1.5 font-medium text-warning', large ? 'text-base' : 'text-xs')}>
              <MessageSquareText className={cn('mt-0.5 shrink-0', large ? 'size-4' : 'size-3')} aria-hidden /> {item.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

export function TestBadge() {
  return (
    <Badge tone="info"><FlaskConical className="size-3" aria-hidden /> Teste</Badge>
  )
}

/** Detalhe do pedido: itens, valores, horários de cada etapa e histórico de movimentações. */
export function OrderDetailDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const detail = useOrderDetail(orderId)
  const order = detail.data?.order
  const { data: me } = useSession()
  const [paying, setPaying] = useState(false)
  const payable = order && !order.test && order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED' && order.status !== 'AWAITING_CONFIRMATION'
  const canPay = Boolean(me && can(me, 'PAYMENTS_REGISTER') && payable)
  return (
    <Dialog
      open={orderId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={order ? `Pedido ${orderNumber(order.number)} · Mesa ${order.tableLabel}` : 'Pedido'}
      description={order ? `Recebido em ${formatDateTime(order.createdAt)}${order.customerName ? ` · ${order.customerName}` : ''}` : undefined}
    >
      {detail.isPending && <div className="flex flex-col gap-3" aria-busy><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-32 rounded-lg" /></div>}
      {detail.isError && <p className="text-sm text-danger">{detail.error.message}</p>}
      {order && detail.data && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusMeta[order.status].tone} dot>{statusMeta[order.status].label}</Badge>
            <Badge tone="neutral">{order.paymentStatus === 'PAID' ? 'Pago' : 'Pagamento pendente'}</Badge>
            {order.test && <TestBadge />}
            {canPay && (
              <Button size="sm" className="ml-auto" onClick={() => setPaying(true)}><Receipt aria-hidden /> Registrar pagamento</Button>
            )}
          </div>
          {order.cancelReason && (
            <p className="rounded-lg bg-danger-soft px-3.5 py-3 text-[13px] text-danger"><strong className="font-medium">Motivo do cancelamento:</strong> {order.cancelReason}</p>
          )}
          <div className="rounded-lg border border-line">
            <ul className="divide-y divide-line">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                  <ItemsList items={[item]} />
                  <span className="shrink-0 text-sm font-medium text-fg tabular">{formatCents(item.totalCents)}</span>
                </li>
              ))}
            </ul>
            {order.notes && <p className="border-t border-line px-4 py-3 text-[13px] text-fg-secondary"><span className="font-medium">Observação do pedido:</span> {order.notes}</p>}
            <div className="flex items-center justify-between border-t border-line bg-surface-muted/60 px-4 py-3">
              <span className="text-sm font-medium text-fg-secondary">Total</span>
              <span className="text-base font-semibold text-fg tabular">{formatCents(order.totalCents)}</span>
            </div>
          </div>
          <div>
            <h3 className="text-[13px] font-medium text-fg-secondary">Histórico</h3>
            <ol className="mt-2 flex flex-col gap-2.5 border-l border-line pl-4">
              {detail.data.history.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-brand" aria-hidden />
                  <p className="text-sm text-fg">{statusMeta[e.toStatus].label}</p>
                  <p className="text-xs text-muted">{formatDateTime(e.createdAt)}{e.actorName && ` · ${e.actorName}`}{e.reason && ` · ${e.reason}`}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      {order && canPay && (
        <RegisterPaymentDialog
          open={paying}
          onOpenChange={setPaying}
          title={`Pagamento do pedido ${orderNumber(order.number)}`}
          description={`Mesa ${order.tableLabel}`}
          totalCents={order.totalCents}
          target={{ scope: 'ORDER', orderIds: [order.id] }}
        />
      )}
    </Dialog>
  )
}

/** Cancelamento sempre com motivo (fica no histórico e na auditoria; o pedido nunca é apagado). */
export function CancelOrderDialog({ order, onClose }: { order: OrderView | null; onClose: () => void }) {
  const transition = useTransition()
  if (!order) return null
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Cancelar pedido ${orderNumber(order.number)}`}
      description={`Mesa ${order.tableLabel} · ${formatCents(order.totalCents)}. O pedido continua no histórico como cancelado.`}
      confirmLabel="Cancelar pedido"
      tone="danger"
      onConfirm={async (reason) => {
        await transition.mutateAsync({ id: order.id, from: order.status, to: 'CANCELLED', reason })
        toast.success(`Pedido ${orderNumber(order.number)} cancelado.`)
      }}
    />
  )
}

export function RealtimeIndicator({ compact = false }: { compact?: boolean }) {
  const status = useRealtimeStore((s) => s.status)
  const meta = {
    live: { label: 'Tempo real ativo', className: 'text-success', Icon: Wifi },
    connecting: { label: 'Conectando...', className: 'text-warning', Icon: Wifi },
    offline: { label: 'Sem conexão em tempo real', className: 'text-danger', Icon: WifiOff },
  }[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', meta.className)} role="status" aria-live="polite">
      <span className="relative flex size-2">
        {status === 'live' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-40 motion-reduce:animate-none" />}
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
      {!compact && meta.label}
      {compact && <span className="sr-only">{meta.label}</span>}
    </span>
  )
}

export function SoundToggle() {
  const enabled = useRealtimeStore((s) => s.soundEnabled)
  const setEnabled = useRealtimeStore((s) => s.setSoundEnabled)
  return (
    <Tooltip content={enabled ? 'Desativar alertas sonoros neste aparelho' : 'Ativar alertas sonoros neste aparelho'}>
      <Button
        variant="secondary"
        size="icon"
        aria-pressed={enabled}
        aria-label={enabled ? 'Alertas sonoros ativados' : 'Alertas sonoros desativados'}
        onClick={() => {
          unlockAudio()
          setEnabled(!enabled)
        }}
      >
        {enabled ? <Bell /> : <BellOff />}
      </Button>
    </Tooltip>
  )
}
