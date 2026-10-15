import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, CircleAlert, Nfc, Plus, RotateCw, Search, SearchX } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlateCounts, usePlates } from '@/features/admin/management-api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { PlateStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { PlateActions } from './plate-actions'
import { plateStatusMeta } from './plate-meta'

const statusFilters: Array<{ value: PlateStatus | ''; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'AVAILABLE', label: 'Disponíveis' },
  { value: 'RESERVED', label: 'Reservadas' },
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'SUSPENDED', label: 'Suspensas' },
  { value: 'DAMAGED', label: 'Danificadas' },
  { value: 'DEACTIVATED', label: 'Desativadas' },
]

export function PlatesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PlateStatus | ''>('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedValue(search)
  const query = usePlates({ search: debounced, status, page })
  const counts = usePlateCounts()
  const data = query.data

  const countFor = (s: PlateStatus | '') => {
    if (!counts.data) return null
    if (s === '') return Object.values(counts.data).reduce((a, b) => a + b, 0)
    const key = s.toLowerCase() as keyof typeof counts.data
    return counts.data[key]
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Plaquinhas"
        description="Cada plaquinha tem um link permanente gravado no NFC e no QR Code. Vincule, transfira ou bloqueie sem reimprimir nada."
        actions={
          <Button asChild>
            <Link to="/admin/estoque?novo=1">
              <Plus aria-hidden /> Novo lote
            </Link>
          </Button>
        }
      />

      <div role="tablist" aria-label="Filtrar por status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {statusFilters.map((f) => {
          const selected = status === f.value
          const count = countFor(f.value)
          return (
            <button
              key={f.value}
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setStatus(f.value)
                setPage(0)
              }}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                selected ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-fg-secondary hover:border-line-strong',
              )}
            >
              {f.label}
              {count !== null && <span className={cn('tabular text-xs', selected ? 'text-white/60' : 'text-muted')}>{formatNumber(count)}</span>}
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <label htmlFor="plate-search" className="sr-only">
            Buscar plaquinhas
          </label>
          <Input
            id="plate-search"
            type="search"
            placeholder="Buscar por serial (OCT-000123) ou token"
            leading={<Search />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
          />
        </div>

        {query.isPending && (
          <div className="divide-y divide-line" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="ml-auto h-4 w-40" />
              </div>
            ))}
          </div>
        )}

        {query.isError && (
          <EmptyState icon={CircleAlert} title="Não foi possível carregar as plaquinhas" description={query.error.message} action={<Button variant="secondary" onClick={() => query.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />
        )}

        {data && data.items.length === 0 && (
          debounced || status ? (
            <EmptyState icon={SearchX} title="Nenhuma plaquinha encontrada" description="Ajuste a busca ou o filtro de status." />
          ) : (
            <EmptyState
              icon={Nfc}
              title="Estoque vazio"
              description="Cadastre um lote para gerar as plaquinhas, com token, link permanente e QR Code prontos para produção."
              action={<Button asChild><Link to="/admin/estoque?novo=1"><Plus aria-hidden /> Cadastrar lote</Link></Button>}
            />
          )
        )}

        {data && data.items.length > 0 && (
          <>
            <ul className={cn('divide-y divide-line transition-opacity', query.isPlaceholderData && 'opacity-60')}>
              {data.items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink text-white" aria-hidden>
                    <Nfc className="size-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm font-medium text-fg">{p.serial}</span>
                      <Badge tone={plateStatusMeta[p.status].tone} dot>
                        {plateStatusMeta[p.status].label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {p.restaurant ? (
                        <>
                          <Link to={`/admin/restaurantes/${p.restaurant.id}`} className="font-medium text-fg-secondary hover:underline">
                            {p.restaurant.name}
                          </Link>
                          {p.table ? ` · Mesa ${p.table.name}` : ' · sem mesa'}
                        </>
                      ) : (
                        <>Token {p.publicToken} · {p.batch?.name}</>
                      )}
                    </p>
                  </div>
                  <PlateActions plate={p} />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
              <p className="text-[13px] text-muted">{formatNumber(data.totalItems)} plaquinhas</p>
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
