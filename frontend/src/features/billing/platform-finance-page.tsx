import { useState } from 'react'
import { BadgeDollarSign, CircleAlert, CreditCard, Nfc, RotateCw, TrendingDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { KpiCard } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodFilter } from '@/features/finance/period'
import { describePeriod, periodFor, type Period } from '@/features/finance/period-utils'
import { formatCents, plural } from '@/utils/format'
import { usePlatformFinance, type PlatformFinance } from './api'

/** Paleta categórica validada (scripts/validate_palette.js, claro e escuro): verde da marca + azul. */
const SERIES = { subscriptions: '#16a36b', plates: '#2a78d6' }

const monthLabel = (ym: string) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`))

/** Receita da OneCore Business. Não inclui o faturamento dos restaurantes. */
export function PlatformFinancePage() {
  const [period, setPeriod] = useState<Period>(() => periodFor('month'))
  const finance = usePlatformFinance(period.from, period.to)
  const f = finance.data

  return (
    <>
      <PageHeader eyebrow="Comercial" title="Financeiro" description="Receita da OneCore Business com assinaturas e venda de plaquinhas. As vendas dos restaurantes não entram aqui." />
      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} /></div>
      {finance.isError && <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar" description={finance.error.message} action={<Button variant="secondary" onClick={() => finance.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>}
      {finance.isPending && <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>}
      {f && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard icon={CreditCard} label="Receita recorrente (MRR)" value={f.mrrCents} display={formatCents(f.mrrCents)} hint={`${plural(f.payingSubscriptions, 'assinatura pagante', 'assinaturas pagantes')} · ${f.trialing} em teste`} accent />
            <KpiCard icon={BadgeDollarSign} label="Recebido no período" value={f.receivedSubscriptionsCents + f.receivedPlatesCents} display={formatCents(f.receivedSubscriptionsCents + f.receivedPlatesCents)} hint={`${formatCents(f.receivedSubscriptionsCents)} assinaturas · ${formatCents(f.receivedPlatesCents)} plaquinhas`} />
            <KpiCard icon={TrendingDown} label="Inadimplência" value={f.overdueCents} display={formatCents(f.overdueCents)} hint={`${plural(f.overdueRestaurants, 'restaurante', 'restaurantes')} (${(f.delinquencyRate * 100).toFixed(0)}% da base) · ${f.suspended} suspensos`} />
            <KpiCard icon={Nfc} label="Plaquinhas vendidas" value={f.platesSold} hint={`${formatCents(f.platesReceivableCents)} a receber · preço atual ${formatCents(f.platePriceCents)}`} />
          </div>
          <p className="-mt-3 text-xs text-muted">
            {describePeriod(f.from, f.to)}. Recebido = registros de recebimento confirmados. {plural(f.newSubscriptions, 'nova assinatura', 'novas assinaturas')} e {plural(f.cancellations, 'cancelamento', 'cancelamentos')} no período; {formatCents(f.openInvoicesCents)} em cobranças abertas.
          </p>
          <MonthlyChart data={f} />
        </div>
      )}
    </>
  )
}

function MonthTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const subs = payload.find((p) => p.dataKey === 'subscriptions')?.value ?? 0
  const plates = payload.find((p) => p.dataKey === 'plates')?.value ?? 0
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-fg"><span className="size-2 rounded-full" style={{ background: SERIES.subscriptions }} aria-hidden />Assinaturas <strong className="ml-auto tabular">{formatCents(Math.round(subs * 100))}</strong></p>
      <p className="flex items-center gap-2 text-sm text-fg"><span className="size-2 rounded-full" style={{ background: SERIES.plates }} aria-hidden />Plaquinhas <strong className="ml-auto tabular">{formatCents(Math.round(plates * 100))}</strong></p>
    </div>
  )
}

/** Receita recebida por mês, empilhada por origem. Legenda + tabela garantem leitura sem depender da cor. */
function MonthlyChart({ data }: { data: PlatformFinance }) {
  const rows = data.months.map((m) => ({ label: monthLabel(m.month), subscriptions: m.subscriptionsCents / 100, plates: m.platesCents / 100 }))
  const empty = rows.every((r) => r.subscriptions === 0 && r.plates === 0)
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Receita recebida por mês</CardTitle><CardDescription>Últimos 6 meses até o fim do período selecionado.</CardDescription></div>
        <ul className="flex gap-4 text-[13px] text-fg-secondary" aria-label="Legenda">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES.subscriptions }} aria-hidden />Assinaturas</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES.plates }} aria-hidden />Plaquinhas</li>
        </ul>
      </CardHeader>
      <CardContent>
        {empty ? <p className="py-10 text-center text-sm text-muted">Nenhum recebimento registrado nos últimos 6 meses.</p> : (
          <div className="h-64" role="img" aria-label="Gráfico de receita recebida por mês, assinaturas e plaquinhas">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={16}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} width={72} tickFormatter={(v: number) => formatCents(v * 100).replace(',00', '')} />
                <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<MonthTooltip />} />
                <Bar dataKey="subscriptions" stackId="r" fill={SERIES.subscriptions} stroke="var(--color-surface)" strokeWidth={2} maxBarSize={44} />
                <Bar dataKey="plates" stackId="r" fill={SERIES.plates} stroke="var(--color-surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-[13px] font-medium text-brand-700">Ver em tabela</summary>
          <table className="mt-2 w-full text-left text-[13px]">
            <caption className="sr-only">Receita recebida por mês</caption>
            <thead><tr className="text-muted"><th className="py-1 font-medium">Mês</th><th className="py-1 text-right font-medium">Assinaturas</th><th className="py-1 text-right font-medium">Plaquinhas</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.label} className="border-t border-line"><td className="py-1">{r.label}</td><td className="py-1 text-right tabular">{formatCents(Math.round(r.subscriptions * 100))}</td><td className="py-1 text-right tabular">{formatCents(Math.round(r.plates * 100))}</td></tr>)}</tbody>
          </table>
        </details>
      </CardContent>
    </Card>
  )
}
