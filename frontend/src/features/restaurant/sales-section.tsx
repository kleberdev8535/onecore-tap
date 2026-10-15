import { ArrowDownRight, ArrowUpRight, BellRing, ChefHat, CircleCheck, Clock, LayoutGrid, Minus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SalesPeriod, SalesSummary } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents, formatNumber } from '@/utils/format'

const periodLabels: Record<SalesPeriod, string> = { today: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias' }
const previousLabel: Record<SalesPeriod, string> = { today: 'ontem', '7d': '7 dias anteriores', '30d': '30 dias anteriores' }

/** Filtro de período: uma linha acima de tudo o que ele afeta. */
export function PeriodFilter({ value, onChange }: { value: SalesPeriod; onChange: (p: SalesPeriod) => void }) {
  return (
    <div role="radiogroup" aria-label="Período" className="inline-flex rounded-lg bg-surface-muted p-1">
      {(Object.keys(periodLabels) as SalesPeriod[]).map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cn('h-9 rounded-md px-3.5 text-[13px] font-medium transition-colors', value === p ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg')}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  )
}

function Delta({ current, previous, period }: { current: number; previous: number; period: SalesPeriod }) {
  if (previous === 0 && current === 0) return <span className="text-[13px] text-muted">Sem movimento em {previousLabel[period]}</span>
  if (previous === 0) return <span className="text-[13px] text-muted">Sem base em {previousLabel[period]}</span>
  const pct = Math.round(((current - previous) / previous) * 100)
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-muted">
      <Icon className={cn('size-3.5', pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-muted')} aria-hidden />
      <span className="font-medium text-fg-secondary tabular">{pct > 0 ? '+' : ''}{pct}%</span> vs {previousLabel[period]}
    </span>
  )
}

function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 sm:p-5">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-fg tabular sm:text-[30px]">{value}</p>
        <div className="mt-2">{children}</div>
      </CardContent>
    </Card>
  )
}

export function SalesSection({ sales, loading }: { sales: SalesSummary; loading: boolean }) {
  const { current: c, previous: p, live, period } = sales
  const liveItems = [
    { icon: Clock, label: 'Aguardando confirmação', value: live.awaitingConfirmation, alert: live.awaitingConfirmation > 0 },
    { icon: ChefHat, label: 'Na fila e em preparo', value: live.newOrders + live.inPreparation },
    { icon: CircleCheck, label: 'Prontos para entregar', value: live.ready },
    { icon: LayoutGrid, label: 'Mesas em atendimento', value: live.occupiedTables },
    { icon: BellRing, label: 'Chamados abertos', value: live.openRequests, alert: live.openRequests > 0 },
  ]

  return (
    <div className={cn('flex flex-col gap-6 transition-opacity duration-200', loading && 'opacity-60')} aria-busy={loading}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Vendas" value={formatCents(c.revenueCents)}><Delta current={c.revenueCents} previous={p.revenueCents} period={period} /></Stat>
        <Stat label="Pedidos" value={formatNumber(c.orders)}><Delta current={c.orders} previous={p.orders} period={period} /></Stat>
        <Stat label="Ticket médio" value={formatCents(c.averageTicketCents)}><Delta current={c.averageTicketCents} previous={p.averageTicketCents} period={period} /></Stat>
        <Stat label="Cancelados" value={formatNumber(c.cancelled)}><span className="text-[13px] text-muted">{formatNumber(p.cancelled)} em {previousLabel[period]}</span></Stat>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
          {liveItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', item.alert ? 'bg-warning-soft text-warning' : 'bg-surface-muted text-fg-secondary')}>
                <item.icon className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold leading-tight text-fg tabular">{formatNumber(item.value)}</span>
                <span className="block text-xs leading-snug text-muted">{item.label}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {period === 'today' ? <HourlyChart sales={sales} /> : <DailyChart sales={sales} />}
        <TopProducts sales={sales} />
      </div>
      {period !== 'today' && <HourlyChart sales={sales} />}
      {sales.testOrders > 0 && <p className="text-xs text-muted">{formatNumber(sales.testOrders)} pedidos de teste no período não entram nos números.</p>}
    </div>
  )
}

const axisTick = { fontSize: 12, fill: 'var(--color-muted)' }
const BAR = 'var(--color-brand)'

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { value: number }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="text-sm font-semibold text-fg tabular">{format(payload[0].value)}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

const dayLabel = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(iso))

function DailyChart({ sales }: { sales: SalesSummary }) {
  // Dias sem venda aparecem como zero: o eixo do tempo não pula datas.
  const byDay = new Map(sales.daily.map((d) => [d.day, d]))
  const data: { day: string; label: string; revenue: number; orders: number }[] = []
  for (let d = new Date(`${sales.from}T00:00:00Z`); d <= new Date(`${sales.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    const point = byDay.get(key)
    data.push({ day: key, label: dayLabel(key), revenue: (point?.revenueCents ?? 0) / 100, orders: point?.orders ?? 0 })
  }
  const empty = data.every((d) => d.revenue === 0)
  return (
    <Card>
      <CardHeader><div><CardTitle>Vendas por dia</CardTitle><CardDescription>Total dos pedidos não cancelados, em reais.</CardDescription></div></CardHeader>
      <CardContent>
        {empty ? <EmptyChart /> : (
          <div className="h-64" role="img" aria-label="Gráfico de vendas por dia">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={data.length > 10 ? 2 : 8}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatCents(v * 100).replace(',00', '')} />
                <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<ChartTooltip format={(v) => formatCents(Math.round(v * 100))} />} />
                <Bar dataKey="revenue" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <DataTable caption="Vendas por dia" headers={['Dia', 'Pedidos', 'Vendas']} rows={data.filter((d) => d.orders > 0).map((d) => [d.label, formatNumber(d.orders), formatCents(Math.round(d.revenue * 100))])} />
      </CardContent>
    </Card>
  )
}

function HourlyChart({ sales }: { sales: SalesSummary }) {
  const data = sales.hourly.map((h) => ({ label: `${String(h.hour).padStart(2, '0')}h`, orders: h.orders }))
  const empty = data.every((d) => d.orders === 0)
  const peak = empty ? null : data.reduce((a, b) => (b.orders > a.orders ? b : a))
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Horários de maior movimento</CardTitle>
          <CardDescription>{peak ? `Pico às ${peak.label}, com ${peak.orders} ${peak.orders === 1 ? 'pedido' : 'pedidos'}.` : 'Pedidos por hora do dia.'}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {empty ? <EmptyChart /> : (
          <div className="h-56" role="img" aria-label="Gráfico de pedidos por hora do dia">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--color-line)" />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<ChartTooltip format={(v) => `${v} ${v === 1 ? 'pedido' : 'pedidos'}`} />} />
                <Bar dataKey="orders" fill={BAR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <DataTable caption="Pedidos por hora" headers={['Hora', 'Pedidos']} rows={data.filter((d) => d.orders > 0).map((d) => [d.label, formatNumber(d.orders)])} />
      </CardContent>
    </Card>
  )
}

function TopProducts({ sales }: { sales: SalesSummary }) {
  const max = Math.max(1, ...sales.topProducts.map((t) => t.quantity))
  return (
    <Card>
      <CardHeader><div><CardTitle>Mais vendidos</CardTitle><CardDescription>Por quantidade no período.</CardDescription></div></CardHeader>
      <CardContent>
        {sales.topProducts.length === 0 ? <EmptyChart /> : (
          <ol className="flex flex-col gap-3.5">
            {sales.topProducts.map((t, i) => (
              <li key={t.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-fg"><span className="mr-2 text-muted tabular">{i + 1}</span>{t.name}</span>
                  <span className="shrink-0 font-semibold text-fg tabular">{formatNumber(t.quantity)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(t.quantity / max) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-muted tabular">{formatCents(t.revenueCents)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return <p className="flex h-40 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">Nenhum pedido no período.</p>
}

/** Tabela equivalente ao gráfico, para leitores de tela e para quem prefere os números. */
function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return null
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-fg">Ver em tabela</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{headers.map((h) => <th key={h} className="border-b border-line py-1.5 text-xs font-medium text-muted">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((cell, i) => <td key={i} className="border-b border-line py-1.5 tabular text-fg-secondary">{cell}</td>)}</tr>)}</tbody>
      </table>
    </details>
  )
}
