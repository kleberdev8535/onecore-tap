import { Link } from 'react-router'
import { BellRing, ChevronRight, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/http'
import type { ServiceRequestType } from '@/types/api'
import { formatCents } from '@/utils/format'
import { useServiceRequest, useTableSession } from './public-api'
import { customerStatus } from './status-steps'

/** "Minha mesa": pedidos deste aparelho, valor parcial da mesa e chamados. Pedir a conta não marca nada como pago. */
export function TableSheet({ token, tableLabel, onClose }: { token: string; tableLabel: string; onClose: () => void }) {
  const session = useTableSession(token)
  const request = useServiceRequest(token)
  const pending = new Set(session.data?.openRequests ?? [])

  const call = async (type: ServiceRequestType) => {
    try {
      await request.mutateAsync(type)
      toast.success(type === 'REQUEST_BILL' ? 'Pedido de conta enviado. Um atendente já vem.' : 'Garçom chamado. Já vamos até a sua mesa.')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível enviar. Tente novamente.')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Mesa ${tableLabel}`} description="Seus pedidos e o atendimento da mesa">
      <div className="grid grid-cols-2 gap-3">
        <ActionButton icon={BellRing} label={pending.has('CALL_WAITER') ? 'Garçom chamado' : 'Chamar garçom'} done={pending.has('CALL_WAITER')} onClick={() => call('CALL_WAITER')} />
        <ActionButton icon={Receipt} label={pending.has('REQUEST_BILL') ? 'Conta solicitada' : 'Pedir a conta'} done={pending.has('REQUEST_BILL')} onClick={() => call('REQUEST_BILL')} />
      </div>

      {session.isPending && <Skeleton className="mt-5 h-28 rounded-xl" />}
      {session.data && (
        <>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3.5">
            <div>
              <p className="text-[13px] text-muted">Valor parcial da mesa</p>
              <p className="text-xs text-muted">{session.data.tableOrders} {session.data.tableOrders === 1 ? 'pedido' : 'pedidos'} neste atendimento</p>
            </div>
            <p className="text-xl font-semibold text-fg tabular">{formatCents(session.data.tableTotalCents)}</p>
          </div>
          <h3 className="mt-5 text-[13px] font-medium text-fg-secondary">Pedidos feitos neste celular</h3>
          {session.data.myOrders.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum pedido ainda.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {session.data.myOrders.map((o) => (
                <li key={o.trackingToken}>
                  <Link to={`/t/${token}/pedido/${o.trackingToken}`} onClick={onClose} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-fg">Pedido #{String(o.number).padStart(4, '0')}</p>
                      <p className="truncate text-[13px] text-muted">{customerStatus(o.status).label} · {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</p>
                    </div>
                    <span className="text-sm font-semibold text-fg tabular">{formatCents(o.totalCents)}</span>
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted">O pagamento é feito com a equipe do restaurante. Pedir a conta apenas avisa o atendente.</p>
        </>
      )}
    </Dialog>
  )
}

function ActionButton({ icon: Icon, label, done, onClick }: { icon: typeof BellRing; label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={done}
      className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-medium text-fg transition-colors hover:bg-surface-muted"
      style={done ? { borderColor: 'var(--m-primary)' } : undefined}
    >
      <Icon className="size-5" style={{ color: 'var(--m-ink)' }} aria-hidden />
      {label}
    </button>
  )
}
