import { useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert, CreditCard, PlayCircle, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import { formatCents, plural } from '@/utils/format'
import { useRunBillingCycle, useSubscriptions, type SubscriptionStatus } from './api'
import { formatIsoDay, subscriptionMeta } from './billing-meta'

const filters: { value: SubscriptionStatus | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'ACTIVE', label: 'Em dia' },
  { value: 'PAST_DUE', label: 'Em atraso' },
  { value: 'TRIALING', label: 'Em teste' },
  { value: 'SUSPENDED', label: 'Suspensas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

export function SubscriptionsPage() {
  const list = useSubscriptions()
  const run = useRunBillingCycle()
  const [status, setStatus] = useState<SubscriptionStatus | ''>('')
  const items = (list.data ?? []).filter((s) => !status || s.status === status)

  const runNow = async () => {
    try {
      const r = await run.mutateAsync(undefined)
      toast.success('Rotina de cobrança executada.', {
        description: `${plural(r.invoicesIssued, 'cobrança emitida', 'cobranças emitidas')}, ${plural(r.markedPastDue, 'atraso', 'atrasos')}, ${plural(r.suspended, 'suspensão', 'suspensões')}, ${plural(r.trialsConverted, 'teste convertido', 'testes convertidos')}.`,
      })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível executar a rotina.')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Assinaturas"
        description="Situação de cada restaurante com a OneCore Business. A rotina diária emite cobranças, marca atrasos e suspende após a carência."
        actions={<Button variant="secondary" onClick={runNow} loading={run.isPending}><PlayCircle aria-hidden /> Executar rotina agora</Button>}
      />
      <div role="radiogroup" aria-label="Filtrar por situação" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {filters.map((f) => {
          const count = f.value ? list.data?.filter((s) => s.status === f.value).length : list.data?.length
          return (
            <button key={f.value} role="radio" aria-checked={status === f.value} onClick={() => setStatus(f.value)}
              className={cn('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors', status === f.value ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-fg-secondary hover:border-line-strong')}>
              {f.label}{count !== undefined && <span className={cn('text-xs tabular', status === f.value ? 'text-white/60' : 'text-muted')}>{count}</span>}
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        {list.isPending && <div className="p-4"><Skeleton className="h-40 w-full" /></div>}
        {list.isError && <EmptyState icon={CircleAlert} title="Não foi possível carregar as assinaturas" description={list.error.message} action={<Button variant="secondary" onClick={() => list.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />}
        {list.data && items.length === 0 && (
          <EmptyState icon={CreditCard} title={list.data.length ? 'Nenhuma assinatura nesta situação' : 'Nenhuma assinatura ainda'} description="A assinatura nasce quando um restaurante é ativado ou inicia o período de teste." />
        )}
        {items.length > 0 && (
          <>
            <table className="hidden w-full text-left text-sm md:table">
              <caption className="sr-only">Assinaturas</caption>
              <thead>
                <tr className="border-b border-line bg-surface-muted/60 text-xs font-medium uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Restaurante</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plano</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Mensal</th>
                  <th scope="col" className="px-4 py-3 font-medium">Próximo vencimento</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Em atraso</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface-muted/60">
                    <td className="px-4 py-3.5"><Link to={`/admin/restaurantes/${s.restaurantId}?aba=cobranca`} className="font-medium text-fg hover:underline">{s.restaurantName}</Link></td>
                    <td className="px-4 py-3.5"><Badge tone={subscriptionMeta[s.status].tone} dot>{subscriptionMeta[s.status].label}</Badge></td>
                    <td className="px-4 py-3.5 text-fg-secondary">{s.planName}</td>
                    <td className="px-4 py-3.5 text-right tabular">{formatCents(s.priceCents)}</td>
                    <td className="px-4 py-3.5 text-fg-secondary tabular">{s.nextDueDate ? formatIsoDay(s.nextDueDate) : '-'}</td>
                    <td className={cn('px-4 py-3.5 text-right tabular', s.overdueCents > 0 ? 'font-semibold text-warning' : 'text-muted')}>{formatCents(s.overdueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {items.map((s) => (
                <li key={s.id}>
                  <Link to={`/admin/restaurantes/${s.restaurantId}?aba=cobranca`} className="block px-4 py-4 active:bg-surface-muted">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-fg">{s.restaurantName}</span>
                      <Badge tone={subscriptionMeta[s.status].tone} dot>{subscriptionMeta[s.status].label}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">{s.planName} · {formatCents(s.priceCents)}/mês{s.overdueCents > 0 && ` · ${formatCents(s.overdueCents)} em atraso`}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  )
}
