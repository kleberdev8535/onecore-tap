import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/utils/cn'
import { formatCents, formatNumber } from '@/utils/format'
import { addDays } from './period-utils'

const axisTick = { fontSize: 12, fill: 'var(--color-muted)' }

/** Variação frente ao período anterior; sem base de comparação, diz isso em vez de inventar percentual. */
export function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) {
    return <span className="text-[13px] text-muted">{current === 0 ? 'Sem movimento nos dois períodos' : 'Sem base no período anterior'}</span>
  }
  const pct = ((current - previous) / previous) * 100
  const up = pct > 0.5
  const down = pct < -0.5
  const good = invert ? down : up
  const bad = invert ? up : down
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span className={cn('inline-flex items-center gap-1 text-[13px] font-medium', good && 'text-success', bad && 'text-danger', !good && !bad && 'text-muted')}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(pct).toFixed(0)}% vs. período anterior
    </span>
  )
}

/** Ranking em barras horizontais: o comprimento compara, o valor fica escrito (nunca só a cor). */
export function RankList({ rows, valueLabel, empty }: { rows: { name: string; value: number; detail?: string }[]; valueLabel: (v: number) => string; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-fg">{r.name}</span>
            <span className="shrink-0 font-medium text-fg tabular">{valueLabel(r.value)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            {r.detail && <span className="w-20 shrink-0 text-right text-xs text-muted tabular">{r.detail}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

const dayLabel = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { orders: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="text-sm font-semibold text-fg tabular">{formatCents(Math.round(payload[0].value * 100))}</p>
      <p className="text-xs text-muted">{label} · {payload[0].payload.orders} {payload[0].payload.orders === 1 ? 'pedido' : 'pedidos'}</p>
    </div>
  )
}

/** Vendas por dia (uma série). Dias sem venda aparecem como zero: o eixo do tempo não pula datas. */
export function DailySalesChart({ from, to, daily }: { from: string; to: string; daily: { day: string; soldCents: number; orders: number }[] }) {
  const byDay = new Map(daily.map((d) => [d.day, d]))
  const data: { label: string; sold: number; orders: number }[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const p = byDay.get(d)
    data.push({ label: dayLabel(d), sold: (p?.soldCents ?? 0) / 100, orders: p?.orders ?? 0 })
  }
  if (data.every((d) => d.sold === 0)) return <p className="py-10 text-center text-sm text-muted">Nenhuma venda no período.</p>
  return (
    <>
      <div className="h-60" role="img" aria-label="Gráfico de vendas por dia">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={data.length > 10 ? 2 : 8}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatCents(v * 100).replace(',00', '')} />
            <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<MoneyTooltip />} />
            <Bar dataKey="sold" fill="var(--color-brand)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-[13px] font-medium text-brand-700">Ver em tabela</summary>
        <table className="mt-2 w-full text-left text-[13px]">
          <caption className="sr-only">Vendas por dia</caption>
          <thead><tr className="text-muted"><th className="py-1 font-medium">Dia</th><th className="py-1 font-medium">Pedidos</th><th className="py-1 text-right font-medium">Vendas</th></tr></thead>
          <tbody>
            {data.filter((d) => d.orders > 0).map((d) => (
              <tr key={d.label} className="border-t border-line"><td className="py-1">{d.label}</td><td className="py-1 tabular">{formatNumber(d.orders)}</td><td className="py-1 text-right tabular">{formatCents(Math.round(d.sold * 100))}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}
