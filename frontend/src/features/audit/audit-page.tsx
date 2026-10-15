import { useState } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, RotateCw, ScrollText, Search } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAudit } from '@/features/admin/management-api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { AuditEntry } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatDateTime, formatNumber } from '@/utils/format'
import { auditActionLabels, parseDetails } from './audit-labels'

const sensitive = new Set(['LOGIN_FAILED', 'LOGIN_BLOCKED', 'SESSION_REVOKED', 'USER_DEACTIVATED', 'RESTAURANT_STATUS_CHANGED'])

export function AuditPage() {
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const debouncedActor = useDebouncedValue(actor)
  const query = useAudit({ action, actor: debouncedActor, from, to, page })
  const data = query.data
  const reset = (fn: () => void) => { fn(); setPage(0) }

  return (
    <>
      <PageHeader eyebrow="Gestão" title="Auditoria" description="Registro imutável de acessos e ações sensíveis em toda a plataforma." />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input aria-label="Filtrar por e-mail" type="search" placeholder="E-mail de quem agiu" leading={<Search />} value={actor} onChange={(e) => reset(() => setActor(e.target.value))} />
          <Select aria-label="Filtrar por ação" value={action} onChange={(e) => reset(() => setAction(e.target.value))}>
            <option value="">Todas as ações</option>
            {Object.entries(auditActionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input aria-label="Data inicial" type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} />
          <Input aria-label="Data final" type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} />
        </div>

        {query.isPending && <div className="divide-y divide-line" aria-busy>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="px-4 py-3.5"><Skeleton className="h-4 w-56" /><Skeleton className="mt-2 h-3 w-72" /></div>)}</div>}
        {query.isError && <EmptyState icon={CircleAlert} title="Não foi possível carregar a auditoria" description={query.error.message} action={<Button variant="secondary" onClick={() => query.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />}
        {data && data.items.length === 0 && <EmptyState icon={ScrollText} title="Nenhum registro" description="Nenhum evento corresponde aos filtros aplicados." />}

        {data && data.items.length > 0 && (
          <>
            <ul className={cn('divide-y divide-line', query.isPlaceholderData && 'opacity-60')}>
              {data.items.map((e) => <AuditRow key={e.id} entry={e} />)}
            </ul>
            <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
              <p className="text-[13px] text-muted">{formatNumber(data.totalItems)} registros</p>
              {data.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-muted tabular">Página {data.page + 1} de {data.totalPages}</span>
                  <Button variant="secondary" size="icon-sm" aria-label="Página anterior" disabled={data.page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button>
                  <Button variant="secondary" size="icon-sm" aria-label="Próxima página" disabled={data.page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const details = parseDetails(entry.details)
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', sensitive.has(entry.action) ? 'bg-warning' : 'bg-brand')} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="text-sm font-medium text-fg">{auditActionLabels[entry.action] ?? entry.action}</p>
          <time className="shrink-0 text-xs text-muted tabular" dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
        </div>
        <p className="truncate text-[13px] text-muted">
          {entry.actorEmail ?? 'Sistema'}
          {entry.restaurantName && ` · ${entry.restaurantName}`}
          {entry.ipAddress && ` · IP ${entry.ipAddress}`}
        </p>
        {details && <p className="mt-1 break-words font-mono text-xs text-fg-secondary">{details}</p>}
      </div>
    </li>
  )
}
