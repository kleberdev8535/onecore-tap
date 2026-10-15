import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, ChevronRight as RowArrow, CircleAlert, Plus, RotateCw, Search, SearchX, Store } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { RestaurantListItem, RestaurantStatus } from '@/types/api'
import { formatDate, formatNumber } from '@/utils/format'
import { useRestaurants } from './api'
import { CreateRestaurantDialog } from './create-restaurant-dialog'
import { RestaurantStatusBadge } from './restaurant-status'
import { restaurantStatusMeta } from './restaurant-status-meta'

export function RestaurantsPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RestaurantStatus | ''>('')
  const [page, setPage] = useState(0)
  const debouncedSearch = useDebouncedValue(search)
  const query = useRestaurants({ search: debouncedSearch, status, page })
  const createOpen = params.get('novo') === '1'

  const setCreateOpen = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('novo', '1')
    else next.delete('novo')
    setParams(next, { replace: true })
  }

  const filtered = Boolean(debouncedSearch.trim() || status)
  const data = query.data

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Restaurantes"
        description="Todos os estabelecimentos atendidos pela OneCore Tap."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden /> Novo restaurante
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="restaurant-search" className="sr-only">
              Buscar restaurantes
            </label>
            <Input
              id="restaurant-search"
              type="search"
              placeholder="Buscar por nome, identificador ou CNPJ"
              leading={<Search />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </div>
          <div className="sm:w-52">
            <label htmlFor="restaurant-status" className="sr-only">
              Filtrar por status
            </label>
            <Select
              id="restaurant-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as RestaurantStatus | '')
                setPage(0)
              }}
            >
              <option value="">Todos os status</option>
              {Object.entries(restaurantStatusMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {query.isPending && <TableSkeleton />}

        {query.isError && (
          <EmptyState
            icon={CircleAlert}
            title="Não foi possível carregar os restaurantes"
            description={query.error.message}
            action={
              <Button variant="secondary" onClick={() => query.refetch()}>
                <RotateCw aria-hidden /> Tentar novamente
              </Button>
            }
          />
        )}

        {data && data.items.length === 0 && (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="Nenhum resultado"
              description="Nenhum restaurante corresponde aos filtros aplicados."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setStatus('')
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Store}
              title="Nenhum restaurante ainda"
              description="Cadastre o primeiro estabelecimento para começar a implantação: dados comerciais, identidade, mesas e plaquinhas."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden /> Cadastrar restaurante
                </Button>
              }
            />
          )
        )}

        {data && data.items.length > 0 && (
          <>
            <RestaurantTable items={data.items} dimmed={query.isPlaceholderData} />
            <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
              <p className="text-[13px] text-muted">
                {formatNumber(data.totalItems)} {data.totalItems === 1 ? 'restaurante' : 'restaurantes'}
              </p>
              {data.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-muted tabular">
                    Página {data.page + 1} de {data.totalPages}
                  </span>
                  <Button variant="secondary" size="icon-sm" aria-label="Página anterior" disabled={data.page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft />
                  </Button>
                  <Button variant="secondary" size="icon-sm" aria-label="Próxima página" disabled={data.page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <CreateRestaurantDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

function RestaurantTable({ items, dimmed }: { items: RestaurantListItem[]; dimmed: boolean }) {
  const navigate = useNavigate()
  return (
    <div className={dimmed ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {/* Desktop/tablet: tabela */}
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">Lista de restaurantes</caption>
        <thead>
          <tr className="border-b border-line bg-surface-muted/60 text-xs font-medium uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Restaurante</th>
            <th scope="col" className="px-4 py-3 font-medium">Cidade</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Cadastro</th>
            <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr
              key={r.id}
              onClick={() => navigate(`/admin/restaurantes/${r.id}`)}
              className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-muted/70"
            >
              <td className="px-4 py-3.5">
                <Link to={`/admin/restaurantes/${r.id}`} className="font-medium text-fg outline-none after:absolute focus-visible:underline" onClick={(e) => e.stopPropagation()}>
                  {r.tradeName}
                </Link>
                <p className="text-xs text-muted">{r.slug}</p>
              </td>
              <td className="px-4 py-3.5 text-fg-secondary">{r.city ? `${r.city}${r.state ? ` - ${r.state}` : ''}` : <span className="text-muted">Não informada</span>}</td>
              <td className="px-4 py-3.5"><RestaurantStatusBadge status={r.status} /></td>
              <td className="px-4 py-3.5 text-fg-secondary tabular">{formatDate(r.createdAt)}</td>
              <td className="px-4 py-3.5 text-muted"><RowArrow className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: lista em cards */}
      <ul className="divide-y divide-line md:hidden">
        {items.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/restaurantes/${r.id}`} className="flex items-center gap-3 px-4 py-4 active:bg-surface-muted">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{r.tradeName}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{r.city ? `${r.city}${r.state ? ` - ${r.state}` : ''}` : r.slug}</p>
                <div className="mt-2"><RestaurantStatusBadge status={r.status} /></div>
              </div>
              <RowArrow className="size-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-line" aria-busy>
      <span className="sr-only" role="status">Carregando restaurantes</span>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="flex-1">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
          <Skeleton className="hidden h-4 w-28 md:block" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}
