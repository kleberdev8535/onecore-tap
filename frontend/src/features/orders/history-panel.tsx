import { useState } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, ClipboardList, RotateCw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { OrderStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents, formatDateTime, formatNumber } from '@/utils/format'
import { useOrderHistory } from './api'
import { statusMeta } from './order-meta'
import { orderNumber } from './order-format'
import { TestBadge } from './order-parts'

/** Histórico paginado de pedidos: nada é apagado, cancelamentos ficam visíveis com o motivo. */
export function HistoryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedValue(search)
  const query = useOrderHistory({ status, search: debounced, from, to, page }, true)
  const data = query.data
  const reset = (fn: () => void) => { fn(); setPage(0) }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 gap-3 border-b border-line p-4 md:grid-cols-[minmax(0,1fr)_200px_160px_160px]">
        <div>
          <label htmlFor="order-search" className="sr-only">Buscar por número ou mesa</label>
          <Input id="order-search" type="search" placeholder="Número do pedido ou mesa" leading={<Search />} value={search} onChange={(e) => reset(() => setSearch(e.target.value))} />
        </div>
        <Select aria-label="Filtrar por etapa" value={status} onChange={(e) => reset(() => setStatus(e.target.value as OrderStatus | ''))}>
          <option value="">Todas as etapas</option>
          {(Object.keys(statusMeta) as OrderStatus[]).map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}
        </Select>
        <Input type="date" aria-label="De" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} />
        <Input type="date" aria-label="Até" value={to} onChange={(e) => reset(() => setTo(e.target.value))} />
      </div>

      {query.isPending && <div className="divide-y divide-line" aria-busy>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-4 py-4"><Skeleton className="h-4 w-56" /></div>)}</div>}
      {query.isError && <EmptyState icon={CircleAlert} title="Não foi possível carregar o histórico" description={query.error.message} action={<Button variant="secondary" onClick={() => query.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />}
      {data && data.items.length === 0 && <EmptyState icon={ClipboardList} title="Nenhum pedido encontrado" description="Os pedidos feitos pelas plaquinhas aparecem aqui, inclusive os cancelados." />}

      {data && data.items.length > 0 && (
        <>
          <ul className={cn('divide-y divide-line', query.isPlaceholderData && 'opacity-60')}>
            {data.items.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => onOpen(o.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-muted/60 focus-visible:bg-surface-muted focus-visible:outline-none">
                  <span className="w-16 shrink-0 text-sm font-semibold text-fg tabular">{orderNumber(o.number)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm text-fg">
                      Mesa {o.tableLabel}
                      <Badge tone={statusMeta[o.status].tone} dot>{statusMeta[o.status].label}</Badge>
                      {o.test && <TestBadge />}
                    </span>
                    <span className="block truncate text-xs text-muted">{formatDateTime(o.createdAt)} · {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</span>
                  </span>
                  <span className={cn('shrink-0 text-sm font-semibold tabular', o.status === 'CANCELLED' ? 'text-muted line-through' : 'text-fg')}>{formatCents(o.totalCents)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
            <p className="text-[13px] text-muted">{formatNumber(data.totalItems)} pedidos</p>
            {data.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon-sm" aria-label="Página anterior" disabled={data.page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button>
                <span className="text-xs text-muted tabular">{data.page + 1}/{data.totalPages}</span>
                <Button variant="secondary" size="icon-sm" aria-label="Próxima página" disabled={data.page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
