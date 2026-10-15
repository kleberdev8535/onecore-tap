import { useState } from 'react'
import { CircleAlert, FileSpreadsheet, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import { downloadFile } from '@/utils/download'
import { formatCents, formatNumber } from '@/utils/format'
import { useReportSummary, type FinanceSummary, type FinanceTotals } from './api'
import { PeriodFilter } from './period'
import { addDays, describePeriod, periodFor, type Period } from './period-utils'

const metrics: { key: keyof FinanceTotals; label: string; money: boolean; invert?: boolean }[] = [
  { key: 'soldCents', label: 'Total vendido', money: true },
  { key: 'orders', label: 'Pedidos', money: false },
  { key: 'averageTicketCents', label: 'Ticket médio', money: true },
  { key: 'paidCents', label: 'Recebido (registrado)', money: true },
  { key: 'pendingCents', label: 'A receber', money: true, invert: true },
  { key: 'cancelledOrders', label: 'Cancelamentos', money: false, invert: true },
  { key: 'cancelledCents', label: 'Valor cancelado', money: true, invert: true },
]

/** Compara dois períodos quaisquer e exporta os dados em CSV (abre no Excel e no Google Planilhas). */
export function ReportsPage() {
  const [a, setA] = useState<Period>(() => periodFor('month'))
  const [b, setB] = useState<{ from: string; to: string } | null>(null)
  const span = Math.round((Date.parse(a.to) - Date.parse(a.from)) / 86_400_000)
  const compare = b ?? { from: addDays(a.from, -(span + 1)), to: addDays(a.from, -1) }
  const main = useReportSummary(a.from, a.to)
  const other = useReportSummary(compare.from, compare.to)
  const [exporting, setExporting] = useState<string | null>(null)

  const exportCsv = async (kind: 'orders' | 'items') => {
    setExporting(kind)
    try {
      await downloadFile(`/restaurant/reports/${kind}.csv?from=${a.from}&to=${a.to}`, `${kind === 'orders' ? 'pedidos' : 'produtos'}-${a.from}-a-${a.to}.csv`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível exportar.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios"
        description="Compare períodos e exporte pedidos e vendas por produto para planilha."
        actions={
          <>
            <Button variant="secondary" onClick={() => exportCsv('orders')} loading={exporting === 'orders'}><FileSpreadsheet aria-hidden /> Pedidos (CSV)</Button>
            <Button variant="secondary" onClick={() => exportCsv('items')} loading={exporting === 'items'}><FileSpreadsheet aria-hidden /> Produtos (CSV)</Button>
          </>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-5 p-5">
          <div>
            <p className="mb-2 text-[13px] font-medium text-fg-secondary">Período analisado</p>
            <PeriodFilter value={a} onChange={(p) => { setA(p); setB(null) }} />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-fg-secondary">Comparar com {b ? '' : '(período anterior de mesma duração)'}</p>
            <div className="flex items-center gap-2 sm:max-w-md">
              <Input type="date" aria-label="Início da comparação" value={compare.from} max={compare.to} onChange={(e) => e.target.value && setB({ from: e.target.value, to: compare.to })} />
              <span className="text-sm text-muted">a</span>
              <Input type="date" aria-label="Fim da comparação" value={compare.to} min={compare.from} onChange={(e) => e.target.value && setB({ from: compare.from, to: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {(main.isError || other.isError) && (
        <Card><EmptyState icon={CircleAlert} title="Não foi possível gerar o relatório" description={(main.error ?? other.error)?.message ?? ''} action={<Button variant="secondary" onClick={() => { main.refetch(); other.refetch() }}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>
      )}
      {(!main.data || !other.data) && !main.isError && !other.isError && <Skeleton className="h-80 w-full rounded-xl" aria-busy />}
      {main.data && other.data && <Comparison a={main.data} b={other.data} />}
    </>
  )
}

function Comparison({ a, b }: { a: FinanceSummary; b: FinanceSummary }) {
  const productsB = new Map(b.byProduct.map((p) => [p.name, p]))
  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader><div><CardTitle>Comparativo</CardTitle><CardDescription>{describePeriod(a.from, a.to)} vs. {describePeriod(b.from, b.to)}</CardDescription></div></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Comparativo entre os dois períodos</caption>
            <thead>
              <tr className="border-y border-line bg-surface-muted/60 text-xs font-medium uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-3 font-medium">Indicador</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Período analisado</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Comparação</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Variação</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const va = a.current[m.key]
                const vb = b.current[m.key]
                const fmt = (v: number) => (m.money ? formatCents(v) : formatNumber(v))
                return (
                  <tr key={m.key} className="border-b border-line last:border-0">
                    <th scope="row" className="px-5 py-3 font-medium text-fg">{m.label}</th>
                    <td className="px-5 py-3 text-right text-fg tabular">{fmt(va)}</td>
                    <td className="px-5 py-3 text-right text-fg-secondary tabular">{fmt(vb)}</td>
                    <td className="px-5 py-3 text-right"><Variation a={va} b={vb} invert={m.invert} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader><div><CardTitle>Produtos</CardTitle><CardDescription>Os mais vendidos no período analisado, com o resultado na comparação.</CardDescription></div></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {a.byProduct.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Sem vendas no período analisado.</p> : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Vendas por produto nos dois períodos</caption>
              <thead>
                <tr className="border-y border-line bg-surface-muted/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Produto</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Qtd.</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Vendas</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Na comparação</th>
                </tr>
              </thead>
              <tbody>
                {a.byProduct.map((p) => {
                  const prev = productsB.get(p.name)
                  return (
                    <tr key={p.name} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-3 font-medium text-fg">{p.name}</th>
                      <td className="px-5 py-3 text-right tabular">{formatNumber(p.quantity)}</td>
                      <td className="px-5 py-3 text-right tabular">{formatCents(p.totalCents)}</td>
                      <td className="px-5 py-3 text-right text-fg-secondary tabular">{prev ? formatCents(prev.totalCents) : 'Sem vendas'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Variation({ a, b, invert }: { a: number; b: number; invert?: boolean }) {
  if (b === 0) return <span className="text-[13px] text-muted">{a === 0 ? 'Igual' : 'Sem base'}</span>
  const pct = ((a - b) / b) * 100
  const flat = Math.abs(pct) < 0.5
  const good = invert ? pct < 0 : pct > 0
  return (
    <span className={cn('text-[13px] font-medium tabular', flat ? 'text-muted' : good ? 'text-success' : 'text-danger')}>
      {flat ? 'Igual' : `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}%`}
    </span>
  )
}
