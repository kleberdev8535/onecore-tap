import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { BillingDetail } from '@/features/billing/api'
import { chargeMeta, formatIsoDay, subscriptionMeta } from '@/features/billing/billing-meta'
import { http } from '@/services/http'
import { formatCents } from '@/utils/format'

/** Assinatura com a OneCore Business, somente leitura para o proprietário. */
export function SubscriptionCard() {
  const q = useQuery({
    queryKey: ['restaurant', 'subscription'],
    queryFn: async () => (await http.get<BillingDetail | undefined>('/restaurant/subscription')) ?? null,
  })
  const s = q.data?.subscription
  const open = q.data?.invoices.filter((i) => i.status === 'OPEN') ?? []
  return (
    <Card>
      <CardHeader><div><CardTitle>Assinatura</CardTitle><CardDescription>Cobranças da OneCore Business. Dúvidas? Fale com seu contato comercial.</CardDescription></div></CardHeader>
      <CardContent>
        {q.isPending && <Skeleton className="h-20 w-full" />}
        {q.isError && <p className="text-sm text-danger">{q.error.message}</p>}
        {q.data !== undefined && !s && !q.isPending && <p className="text-sm text-muted">A assinatura começa quando o restaurante é ativado.</p>}
        {s && (
          <>
            <div className="flex items-center justify-between gap-3">
              <Badge tone={subscriptionMeta[s.status].tone} dot>{subscriptionMeta[s.status].label}</Badge>
              <span className="text-sm font-semibold text-fg tabular">{formatCents(s.priceCents)}/mês</span>
            </div>
            {s.status === 'TRIALING' && s.trialEndsAt && <p className="mt-2 text-[13px] text-muted">Teste até {new Date(s.trialEndsAt).toLocaleDateString('pt-BR')}.</p>}
            {open.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">Nenhuma cobrança em aberto.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {open.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2 text-[13px]">
                    <span>Vence {formatIsoDay(i.dueDate)}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium tabular">{formatCents(i.amountCents)}</span>
                      {i.overdue ? <Badge tone="warning" dot>Vencida</Badge> : <Badge tone={chargeMeta[i.status].tone}>{chargeMeta[i.status].label}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
