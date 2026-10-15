import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { OrderStatus, OrderView } from '@/types/api'
import { ApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import { useTransition } from './api'
import { OrderCard } from './order-card'
import { canRun, columns, dropTarget } from './order-meta'

interface KanbanBoardProps {
  orders: OrderView[]
  permissions: string[]
  now: number
  onOpen: (id: string) => void
  onCancel: (order: OrderView) => void
}

/**
 * Colunas do fluxo operacional. Soltar um card só é aceito na próxima etapa ou em "Cancelados"; a validação final
 * é sempre do backend, que recusa transições inválidas ou já feitas por outra pessoa.
 */
export function KanbanBoard({ orders, permissions, now, onOpen, onCancel }: KanbanBoardProps) {
  const transition = useTransition()
  const [dragging, setDragging] = useState<OrderView | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const byColumn = useMemo(() => {
    const map = new Map<string, OrderView[]>()
    columns.forEach((c) => map.set(c.key, []))
    orders.forEach((o) => {
      const col = columns.find((c) => c.statuses.includes(o.status))
      if (col) map.get(col.key)!.push(o)
    })
    // Finalizados: mais recentes primeiro. Em andamento: mais antigos primeiro (fila).
    map.forEach((list, key) =>
      list.sort((a, b) => (key === 'completed' || key === 'cancelled' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt))),
    )
    return map
  }, [orders])

  const accepts = (columnKey: string): OrderStatus | null => {
    if (!dragging) return null
    const target = dropTarget(dragging, columnKey)
    if (!target) return null
    if (target === 'CANCELLED') return permissions.includes('ORDERS_MANAGE') ? target : null
    return canRun(permissions, dragging.status, target) ? target : null
  }

  const drop = async (columnKey: string) => {
    const order = dragging
    const target = accepts(columnKey)
    setDragging(null)
    setOver(null)
    if (!order || !target) return
    if (target === 'CANCELLED') return onCancel(order)
    try {
      await transition.mutateAsync({ id: order.id, from: order.status, to: target })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível mover o pedido.')
    }
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="grid auto-cols-[minmax(248px,1fr)] grid-flow-col gap-3">
        {columns.map((col) => {
          const list = byColumn.get(col.key) ?? []
          const target = accepts(col.key)
          return (
            <section
              key={col.key}
              aria-label={`${col.label}: ${list.length} pedidos`}
              onDragOver={(e) => {
                if (!target) return
                e.preventDefault()
                setOver(col.key)
              }}
              onDragLeave={() => setOver((k) => (k === col.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault()
                void drop(col.key)
              }}
              className={cn(
                'flex min-h-[420px] flex-col rounded-xl border bg-surface-muted/60 transition-colors duration-150',
                dragging && target ? 'border-dashed border-brand/50' : 'border-line',
                over === col.key && target && 'bg-brand-50',
                dragging && !target && 'opacity-60',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <h2 className="text-[13px] font-semibold text-fg">{col.label}</h2>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-fg-secondary tabular ring-1 ring-inset ring-line">{list.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2.5">
                {list.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted">Nenhum pedido</p>}
                {list.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    permissions={permissions}
                    now={now}
                    onOpen={onOpen}
                    onCancel={onCancel}
                    onDragStart={setDragging}
                    onDragEnd={() => {
                      setDragging(null)
                      setOver(null)
                    }}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
