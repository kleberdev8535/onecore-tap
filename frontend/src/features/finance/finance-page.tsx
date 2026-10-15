import { useState } from 'react'
import { BadgeDollarSign, Ban, CircleAlert, HandCoins, Receipt, RotateCw, TicketPercent, Undo2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { KpiCard } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/api'
import { can } from '@/features/restaurant/navigation'
import { formatCents, formatDateTime, formatNumber, plural } from '@/utils/format'
import { paymentMethodLabels, useFinanceSummary, usePayments, usePendingPayments, useVoidPayment, type Payment, type PendingTable } from './api'
import { Delta, DailySalesChart, RankList } from './charts'
import { PeriodFilter } from './period'
import { describePeriod, periodFor, type Period } from './period-utils'
import { RegisterPaymentDialog } from './register-payment-dialog'

/** Financeiro do restaurante: vendas x recebimentos registrados, pendências e detalhamentos do período. */
export function FinancePage() {
  const { data: me } = useSession()
  const [period, setPeriod] = useState<Period>(() => periodFor('today'))
  const summary = useFinanceSummary(period.from, period.to)
  const canRegister = me ? can(me, 'PAYMENTS_REGISTER') : false
  const s = summary.data

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Financeiro"
        description="Vendas e pagamentos registrados pela equipe. O registro confirma o recebimento no caixa; não é cobrança online."
      />
      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} /></div>

      {summary.isError && (
        <Card className="mb-6"><EmptyState icon={CircleAlert} title="Não foi possível carregar o financeiro" description={summary.error.message} action={<Button variant="secondary" onClick={() => summary.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>
      )}

      {!s && summary.isPending && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {s && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex-1"><KpiCard icon={BadgeDollarSign} label="Total vendido" value={s.current.soldCents} display={formatCents(s.current.soldCents)} hint={plural(s.current.orders, 'pedido', 'pedidos')} accent /></div>
              <Delta current={s.current.soldCents} previous={s.previous.soldCents} />
            </div>
            <div className="flex flex-col gap-1.5"><div className="flex-1"><KpiCard icon={Wallet} label="Recebido (registrado)" value={s.current.paidCents} display={formatCents(s.current.paidCents)} hint={plural(s.current.paidOrders, 'pedido pago', 'pedidos pagos')} /></div><span className="text-[13px] text-muted">{s.current.soldCents ? Math.round((s.current.paidCents / s.current.soldCents) * 100) : 0}% do vendido</span></div>
            <div className="flex flex-col gap-1.5"><div className="flex-1"><KpiCard icon={HandCoins} label="A receber" value={s.current.pendingCents} display={formatCents(s.current.pendingCents)} hint={plural(s.current.pendingOrders, 'pedido pendente', 'pedidos pendentes')} /></div><span className="text-[13px] text-muted">Inclui pedidos ainda em atendimento</span></div>
            <div className="flex flex-col gap-1.5">
              <div className="flex-1"><KpiCard icon={TicketPercent} label="Ticket médio" value={s.current.averageTicketCents} display={formatCents(s.current.averageTicketCents)} hint={`${plural(s.current.cancelledOrders, 'cancelamento', 'cancelamentos')} (${formatCents(s.current.cancelledCents)})`} /></div>
              <Delta current={s.current.averageTicketCents} previous={s.previous.averageTicketCents} />
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted">
            {describePeriod(s.from, s.to)} comparado a {describePeriod(s.previousFrom, s.previousTo)}. Pedidos cancelados e de teste ficam fora das vendas
            {s.testOrdersExcluded > 0 && ` (${plural(s.testOrdersExcluded, 'pedido de teste ignorado', 'pedidos de teste ignorados')})`}.
          </p>

          {canRegister && <PendingCard />}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader><div><CardTitle>Vendas por dia</CardTitle><CardDescription>Total dos pedidos não cancelados.</CardDescription></div></CardHeader>
              <CardContent><DailySalesChart from={s.from} to={s.to} daily={s.daily} /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Recebido por método</CardTitle><CardDescription>Registros não estornados, pela data do registro.</CardDescription></div></CardHeader>
              <CardContent>
                <RankList rows={s.byMethod.map((m) => ({ name: m.label, value: m.totalCents, detail: plural(m.payments, 'registro', 'registros') }))} valueLabel={formatCents} empty="Nenhum pagamento registrado no período." />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><div><CardTitle>Por categoria</CardTitle></div></CardHeader>
              <CardContent><RankList rows={s.byCategory.map((r) => ({ name: r.name, value: r.totalCents, detail: `${formatNumber(r.quantity)} un.` }))} valueLabel={formatCents} empty="Sem vendas no período." /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Produtos mais vendidos</CardTitle></div></CardHeader>
              <CardContent><RankList rows={s.byProduct.slice(0, 8).map((r) => ({ name: r.name, value: r.totalCents, detail: `${formatNumber(r.quantity)} un.` }))} valueLabel={formatCents} empty="Sem vendas no período." /></CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Por mesa</CardTitle></div></CardHeader>
              <CardContent><RankList rows={s.byTable.slice(0, 8).map((r) => ({ name: `Mesa ${r.name}`, value: r.totalCents, detail: plural(r.quantity, 'pedido', 'pedidos') }))} valueLabel={formatCents} empty="Sem vendas no período." /></CardContent>
            </Card>
          </div>

          <PaymentsCard from={period.from} to={period.to} canVoid={canRegister} voided={s.voidedPayments} />
        </div>
      )}
    </>
  )
}

function PendingCard() {
  const pending = usePendingPayments()
  const [paying, setPaying] = useState<{ table: PendingTable; orderId?: string } | null>(null)
  const total = pending.data?.reduce((a, t) => a + t.totalCents, 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pedidos a receber</CardTitle>
          <CardDescription>{pending.data?.length ? `${formatCents(total)} em ${plural(pending.data.length, 'mesa', 'mesas')}, de qualquer data.` : 'Pedidos aceitos ainda sem pagamento registrado.'}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pending.isPending && <Skeleton className="h-16 w-full" />}
        {pending.data?.length === 0 && <p className="py-4 text-sm text-muted">Nenhum pedido pendente de pagamento.</p>}
        {pending.data && pending.data.length > 0 && (
          <ul className="divide-y divide-line">
            {pending.data.map((t) => (
              <li key={t.tableId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">Mesa {t.tableLabel}</span>
                    {t.attendanceOpen ? <Badge tone="info" dot>Atendimento aberto</Badge> : <Badge tone="warning" dot>Atendimento encerrado</Badge>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {t.orders.map((o) => `#${String(o.number).padStart(4, '0')}`).join(', ')}
                  </p>
                </div>
                <span className="font-semibold text-fg tabular">{formatCents(t.totalCents)}</span>
                <div className="flex gap-2">
                  {t.orders.some((o) => o.currentAttendance) && t.orders.every((o) => o.currentAttendance) ? (
                    <Button size="sm" onClick={() => setPaying({ table: t })}><Receipt aria-hidden /> Receber da mesa</Button>
                  ) : (
                    <Button size="sm" onClick={() => setPaying({ table: t, orderId: 'all' })}><Receipt aria-hidden /> Receber pedidos</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {paying && (
        <RegisterPaymentDialog
          open
          onOpenChange={(o) => !o && setPaying(null)}
          title={`Receber da mesa ${paying.table.tableLabel}`}
          description={`Pedidos ${paying.table.orders.map((o) => `#${String(o.number).padStart(4, '0')}`).join(', ')}.`}
          totalCents={paying.table.totalCents}
          target={paying.orderId ? { scope: 'ORDER', orderIds: paying.table.orders.map((o) => o.id) } : { scope: 'TABLE', tableId: paying.table.tableId }}
        />
      )}
    </Card>
  )
}

function PaymentsCard({ from, to, canVoid, voided }: { from: string; to: string; canVoid: boolean; voided: number }) {
  const [page, setPage] = useState(0)
  const payments = usePayments(from, to, page)
  const [voiding, setVoiding] = useState<Payment | null>(null)
  const voidPayment = useVoidPayment()
  const data = payments.data

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Pagamentos registrados</CardTitle>
          <CardDescription>{voided > 0 ? `${plural(voided, 'estorno', 'estornos')} no período, mantidos no histórico.` : 'Histórico de registros do período.'}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data?.items.length === 0 && <p className="px-5 pb-5 text-sm text-muted">Nenhum pagamento registrado no período.</p>}
        {data && data.items.length > 0 && (
          <ul className="divide-y divide-line border-t border-line">
            {data.items.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={p.voidedAt ? 'font-semibold text-muted line-through tabular' : 'font-semibold text-fg tabular'}>{formatCents(p.totalCents)}</span>
                    {p.entries.map((e, i) => <Badge key={i} tone="neutral">{paymentMethodLabels[e.method]} {p.entries.length > 1 && formatCents(e.amountCents)}</Badge>)}
                    {p.voidedAt && <Badge tone="danger" dot>Estornado</Badge>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {p.tableLabel ? `Mesa ${p.tableLabel} · ` : ''}{p.orderNumbers.map((n) => `#${String(n).padStart(4, '0')}`).join(', ')} · {formatDateTime(p.createdAt)} · {p.registeredBy}
                  </p>
                  {p.voidedAt && <p className="text-xs text-danger">Estornado por {p.voidedBy}: {p.voidReason}</p>}
                </div>
                {canVoid && !p.voidedAt && (
                  <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={() => setVoiding(p)}><Undo2 aria-hidden /> Estornar</Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </CardContent>
      {voiding && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setVoiding(null)}
          title={`Estornar registro de ${formatCents(voiding.totalCents)}`}
          description="Os pedidos voltam para pendente de pagamento. O registro original fica no histórico com o motivo."
          confirmLabel="Estornar registro"
          tone="danger"
          onConfirm={async (reason) => {
            await voidPayment.mutateAsync({ id: voiding.id, reason })
            toast.success('Registro estornado.')
          }}
        >
          <p className="mb-4 flex items-center gap-2 text-[13px] text-fg-secondary"><Ban className="size-4 text-muted" aria-hidden /> Use para lançamentos errados ou devoluções.</p>
        </ReasonDialog>
      )}
    </Card>
  )
}
