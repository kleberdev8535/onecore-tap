import { useMemo, useState } from 'react'
import { ChefHat, CircleAlert, Clock, Maximize, Minimize, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/http'
import type { OrderStatus, OrderView } from '@/types/api'
import { cn } from '@/utils/cn'
import { useOrderBoard, useTransition } from './api'
import { DELAY_LATE, DELAY_WARNING, minutesSince } from './order-meta'
import { orderNumber, useNow } from './order-format'
import { ItemsList, RealtimeIndicator, SoundToggle, TestBadge } from './order-parts'

type Filter = 'all' | 'NEW' | 'IN_PREPARATION' | 'READY'

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Na fila' },
  { key: 'NEW', label: 'Novos' },
  { key: 'IN_PREPARATION', label: 'Em preparo' },
  { key: 'READY', label: 'Prontos' },
]

/**
 * Tela da cozinha para tablets e monitores: leitura à distância, botões grandes e nada de animação decorativa.
 * Mostra só pedidos confirmados; os que aguardam confirmação do salão aparecem apenas como contador.
 */
export function KitchenPage() {
  const board = useOrderBoard()
  const now = useNow(15_000)
  const [filter, setFilter] = useState<Filter>('all')
  const [fullscreen, setFullscreen] = useState(false)

  const orders = useMemo(() => {
    const list = (board.data?.orders ?? []).filter((o) =>
      filter === 'all' ? o.status === 'NEW' || o.status === 'IN_PREPARATION' : o.status === filter,
    )
    const ref = (o: OrderView) => o.confirmedAt ?? o.createdAt
    return list.sort((a, b) => ref(a).localeCompare(ref(b)))
  }, [board.data, filter])

  const counts = useMemo(() => {
    const all = board.data?.orders ?? []
    const c = (s: OrderStatus) => all.filter((o) => o.status === s).length
    return { NEW: c('NEW'), IN_PREPARATION: c('IN_PREPARATION'), READY: c('READY'), waiting: c('AWAITING_CONFIRMATION') }
  }, [board.data])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
      setFullscreen(Boolean(document.fullscreenElement))
    } catch {
      toast.error('Tela cheia indisponível neste navegador.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-[28px] font-semibold tracking-tight text-fg">
            <ChefHat className="size-7 text-brand-700" strokeWidth={1.75} aria-hidden /> Cozinha
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {counts.NEW} novos · {counts.IN_PREPARATION} em preparo · {counts.READY} prontos
            {counts.waiting > 0 && <> · <span className="font-medium text-warning">{counts.waiting} aguardando confirmação do salão</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RealtimeIndicator />
          <SoundToggle />
          <Button variant="secondary" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>{fullscreen ? <Minimize /> : <Maximize />}</Button>
        </div>
      </header>

      <div role="radiogroup" aria-label="Filtrar pedidos" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="radio"
            aria-checked={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn('h-12 rounded-xl px-5 text-base font-semibold transition-colors', filter === f.key ? 'bg-ink text-white' : 'border border-line bg-surface text-fg-secondary hover:bg-surface-muted')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {board.isPending && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>}
      {board.isError && <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar os pedidos" description={board.error.message} action={<Button variant="secondary" onClick={() => board.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>}
      {board.data && orders.length === 0 && <Card><EmptyState icon={ChefHat} title="Nenhum pedido aqui" description="Os pedidos confirmados aparecem nesta tela na ordem de chegada, com alerta sonoro." /></Card>}
      {orders.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => <li key={o.id}><KitchenTicket order={o} now={now} /></li>)}
        </ul>
      )}
    </div>
  )
}

function KitchenTicket({ order: o, now }: { order: OrderView; now: number }) {
  const transition = useTransition()
  const since = o.status === 'READY' ? o.readyAt ?? o.createdAt : o.confirmedAt ?? o.createdAt
  const minutes = minutesSince(since, now)
  const active = o.status !== 'READY'
  const late = active && minutes >= DELAY_LATE
  const warning = active && !late && minutes >= DELAY_WARNING
  const action: { to: OrderStatus; label: string } | null =
    o.status === 'NEW' ? { to: 'IN_PREPARATION', label: 'Iniciar preparo' } : o.status === 'IN_PREPARATION' ? { to: 'READY', label: 'Pronto' } : null

  const run = async () => {
    if (!action) return
    try {
      await transition.mutateAsync({ id: o.id, from: o.status, to: action.to })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível atualizar o pedido.')
    }
  }

  return (
    <article
      aria-label={`Pedido ${orderNumber(o.number)}, mesa ${o.tableLabel}`}
      className={cn('flex h-full flex-col rounded-2xl border-2 bg-surface p-5 shadow-card', late ? 'border-danger' : warning ? 'border-warning' : o.status === 'IN_PREPARATION' ? 'border-brand/50' : 'border-line')}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold leading-none tracking-tight text-fg">Mesa {o.tableLabel}</p>
          <p className="mt-2 text-base font-medium text-muted tabular">{orderNumber(o.number)}</p>
        </div>
        <div className="text-right">
          <p className={cn('inline-flex items-center gap-1.5 text-xl font-bold tabular', late ? 'text-danger' : warning ? 'text-warning' : 'text-fg-secondary')}>
            <Clock className="size-5" aria-hidden /> {minutes} min
          </p>
          <div className="mt-1.5 flex justify-end gap-1.5">
            {late && <Badge tone="danger">Atrasado</Badge>}
            {o.status === 'IN_PREPARATION' && <Badge tone="success" dot>Em preparo</Badge>}
            {o.status === 'READY' && <Badge tone="success" dot>Pronto</Badge>}
            {o.test && <TestBadge />}
          </div>
        </div>
      </header>
      <div className="mt-5 flex-1 border-t border-line pt-4">
        <ItemsList items={o.items} large />
        {o.notes && <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-base font-medium text-warning">{o.notes}</p>}
      </div>
      {action && (
        <Button size="lg" className="mt-5 h-14 w-full text-lg" variant={o.status === 'NEW' ? 'dark' : 'primary'} loading={transition.isPending} onClick={run}>
          {action.label}
        </Button>
      )}
    </article>
  )
}
