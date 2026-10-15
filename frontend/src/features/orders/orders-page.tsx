import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CircleAlert, RotateCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/features/auth/api'
import type { OrderView } from '@/types/api'
import { useOrderBoard } from './api'
import { HistoryPanel } from './history-panel'
import { KanbanBoard } from './kanban-board'
import { useNow } from './order-format'
import { CancelOrderDialog, OrderDetailDialog, RealtimeIndicator, SoundToggle } from './order-parts'
import { RequestsBar } from './requests-bar'

export function OrdersPage() {
  const { data: me } = useSession()
  const board = useOrderBoard()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') === 'historico' ? 'historico' : 'quadro'
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<OrderView | null>(null)
  const permissions = me?.permissions ?? []

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace('#', '')
    const list = board.data?.orders ?? []
    if (!term) return list
    return list.filter((o) => String(o.number).includes(term) || o.tableLabel.toLowerCase().includes(term))
  }, [board.data, search])

  const waiting = (board.data?.orders ?? []).filter((o) => o.status === 'AWAITING_CONFIRMATION').length

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos"
        description={waiting > 0 ? `${waiting} ${waiting === 1 ? 'pedido aguarda' : 'pedidos aguardam'} confirmação antes de ir para a cozinha.` : 'Acompanhe os pedidos das mesas em tempo real.'}
        actions={<div className="flex items-center gap-3"><RealtimeIndicator /><SoundToggle /></div>}
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const copy = new URLSearchParams(params)
          if (v === 'historico') copy.set('aba', 'historico')
          else copy.delete('aba')
          setParams(copy, { replace: true })
        }}
      >
        <TabsList aria-label="Visões dos pedidos" className="mb-5">
          <TabsTrigger value="quadro">Quadro</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="quadro" className="focus-visible:outline-none">
          {board.data && <RequestsBar requests={board.data.requests} canResolve={permissions.includes('ORDERS_MANAGE')} now={now} />}
          <div className="mb-4 max-w-sm">
            <label htmlFor="board-search" className="sr-only">Filtrar por número ou mesa</label>
            <Input id="board-search" type="search" placeholder="Filtrar por número ou mesa" leading={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {board.isPending && <div className="grid grid-cols-2 gap-3 lg:grid-cols-6" aria-busy>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div>}
          {board.isError && <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar os pedidos" description={board.error.message} action={<Button variant="secondary" onClick={() => board.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>}
          {board.data && <KanbanBoard orders={filtered} permissions={permissions} now={now} onOpen={setOpenId} onCancel={setCancelling} />}
          <p className="mt-3 text-xs text-muted">Arraste um card para a próxima etapa ou use o botão do card. Concluídos e cancelados ficam no quadro por 6 horas; todos estão no histórico.</p>
        </TabsContent>
        <TabsContent value="historico" className="focus-visible:outline-none">
          <HistoryPanel onOpen={setOpenId} />
        </TabsContent>
      </Tabs>

      <OrderDetailDialog orderId={openId} onClose={() => setOpenId(null)} />
      <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} />
    </>
  )
}
