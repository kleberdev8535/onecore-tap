import { BellRing, Check, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/http'
import type { ServiceRequestView } from '@/types/api'
import { useResolveRequest } from './api'
import { minutesSince, requestLabels } from './order-meta'

/** Chamados das mesas (garçom e conta) em destaque no topo do painel. */
export function RequestsBar({ requests, canResolve, now }: { requests: ServiceRequestView[]; canResolve: boolean; now: number }) {
  const resolve = useResolveRequest()
  if (requests.length === 0) return null

  const done = async (r: ServiceRequestView) => {
    try {
      await resolve.mutateAsync(r.id)
      toast.success(`Chamado da mesa ${r.tableLabel} atendido.`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível atualizar o chamado.')
    }
  }

  return (
    <section aria-label="Chamados das mesas" className="mb-5 flex flex-wrap gap-2">
      {requests.map((r) => {
        const Icon = r.type === 'REQUEST_BILL' ? Receipt : BellRing
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft py-2 pl-3 pr-2">
            <Icon className="size-4 shrink-0 text-warning" aria-hidden />
            <span className="text-sm">
              <strong className="font-semibold text-fg">Mesa {r.tableLabel}</strong>{' '}
              <span className="text-fg-secondary">{requestLabels[r.type].toLowerCase()} · há {minutesSince(r.createdAt, now)} min</span>
            </span>
            {canResolve && (
              <Button size="sm" variant="secondary" onClick={() => done(r)} aria-label={`Marcar chamado da mesa ${r.tableLabel} como atendido`}>
                <Check aria-hidden /> Atendido
              </Button>
            )}
          </div>
        )
      })}
    </section>
  )
}
