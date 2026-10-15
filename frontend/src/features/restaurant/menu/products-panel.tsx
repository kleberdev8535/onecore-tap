import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, CircleAlert, ImageOff, Layers, MoreHorizontal, Pencil, Plus, RotateCw, Search, SearchX, Star, Tags, Trash2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/services/http'
import type { AddonGroup, Category, Product } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'
import { useAddonGroups, useCategories, useDeleteProduct, useProductAvailability, useProducts, useReorderProducts } from '../api'
import { ProductDialog } from './product-dialog'

export function ProductsPanel({ manage }: { manage: boolean }) {
  const categories = useCategories()
  const products = useProducts()
  const groups = useAddonGroups()
  const [params, setParams] = useSearchParams()
  const categoryFilter = params.get('categoria') ?? ''
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const term = search.trim().toLowerCase()
  const sections = useMemo(() => {
    const all = products.data ?? []
    return (categories.data ?? [])
      .filter((c) => !categoryFilter || c.id === categoryFilter)
      .map((c) => ({
        category: c,
        items: all
          .filter((p) => p.categoryId === c.id)
          .sort((a, b) => a.position - b.position),
      }))
      .map((s) => ({ ...s, visible: term ? s.items.filter((p) => matches(p, term)) : s.items }))
      .filter((s) => !term || s.visible.length > 0)
  }, [products.data, categories.data, categoryFilter, term])

  const setCategory = (id: string) => {
    const copy = new URLSearchParams(params)
    if (id) copy.set('categoria', id)
    else copy.delete('categoria')
    setParams(copy, { replace: true })
  }

  if (categories.isPending || products.isPending) {
    return <div className="flex flex-col gap-4" aria-busy>{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
  }
  if (categories.isError || products.isError) {
    const retry = () => { categories.refetch(); products.refetch() }
    return <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar o cardápio" description={(categories.error ?? products.error)?.message ?? ''} action={<Button variant="secondary" onClick={retry}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>
  }
  if (categories.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Tags}
          title="Comece pelas categorias"
          description="Os produtos ficam organizados em categorias, como Lanches e Bebidas. Crie a primeira para cadastrar produtos."
          action={<Button asChild><Link to="/app/categorias"><Plus aria-hidden /> Criar categoria</Link></Button>}
        />
      </Card>
    )
  }

  const groupById = new Map((groups.data ?? []).map((g) => [g.id, g]))
  const total = products.data.length

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <label htmlFor="product-search" className="sr-only">Buscar produtos</label>
          <Input id="product-search" type="search" placeholder="Buscar por nome ou descrição" leading={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 md:w-56">
            <Select aria-label="Filtrar por categoria" value={categoryFilter} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {manage && <Button onClick={() => setEditing('new')}><Plus aria-hidden /> <span className="hidden sm:inline">Novo produto</span><span className="sm:hidden">Novo</span></Button>}
        </div>
      </div>

      {total === 0 && (
        <Card>
          <EmptyState icon={UtensilsCrossed} title="Nenhum produto cadastrado" description="Cadastre os itens do cardápio com preço, foto, adicionais e variações." action={manage && <Button onClick={() => setEditing('new')}><Plus aria-hidden /> Cadastrar produto</Button>} />
        </Card>
      )}
      {total > 0 && sections.length === 0 && (
        <Card><EmptyState icon={SearchX} title="Nenhum produto encontrado" description="Ajuste a busca ou o filtro de categoria." /></Card>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-5">
          {sections.map(({ category, items, visible }) => (
            <CategorySection key={category.id} category={category} items={items} visible={visible} searching={Boolean(term)} manage={manage} groupById={groupById} onEdit={setEditing} />
          ))}
        </div>
      )}

      {editing && (
        <ProductDialog
          key={editing === 'new' ? 'new' : editing.id}
          product={editing}
          categories={categories.data}
          groups={groups.data ?? []}
          defaultCategoryId={categoryFilter}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function matches(p: Product, term: string) {
  return p.name.toLowerCase().includes(term) || (p.description ?? '').toLowerCase().includes(term)
}

interface SectionProps {
  category: Category
  items: Product[]
  visible: Product[]
  searching: boolean
  manage: boolean
  groupById: Map<string, AddonGroup>
  onEdit: (p: Product) => void
}

function CategorySection({ category, items, visible, searching, manage, groupById, onEdit }: SectionProps) {
  const reorder = useReorderProducts()

  const move = async (index: number, delta: -1 | 1) => {
    const ids = items.map((p) => p.id)
    const target = index + delta
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    try {
      await reorder.mutateAsync({ categoryId: category.id, ids })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível reordenar.')
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted/40 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold text-fg">{category.name}</h2>
          {!category.active && <Badge tone="neutral" dot>Oculta</Badge>}
        </div>
        <span className="shrink-0 text-[13px] text-muted">{items.length} {items.length === 1 ? 'produto' : 'produtos'}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Nenhum produto nesta categoria ainda.</p>
      ) : (
        <ul className={cn('divide-y divide-line', reorder.isPending && 'opacity-60')}>
          {visible.map((p) => {
            const index = items.indexOf(p)
            return (
              <ProductRow
                key={p.id}
                product={p}
                manage={manage}
                groups={p.addonGroupIds.map((id) => groupById.get(id)).filter((g): g is AddonGroup => Boolean(g))}
                canMoveUp={!searching && index > 0}
                canMoveDown={!searching && index < items.length - 1}
                onMove={(delta) => move(index, delta)}
                onEdit={() => onEdit(p)}
              />
            )
          })}
        </ul>
      )}
    </Card>
  )
}

interface RowProps {
  product: Product
  manage: boolean
  groups: AddonGroup[]
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (delta: -1 | 1) => void
  onEdit: () => void
}

function ProductRow({ product: p, manage, groups, canMoveUp, canMoveDown, onMove, onEdit }: RowProps) {
  const availability = useProductAvailability()
  const remove = useDeleteProduct()
  const [deleting, setDeleting] = useState(false)
  const [brokenImage, setBrokenImage] = useState(false)

  const toggle = async (available: boolean) => {
    try {
      await availability.mutateAsync({ id: p.id, available })
      toast.success(available ? `${p.name} disponível novamente.` : `${p.name} marcado como esgotado.`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível alterar a disponibilidade.')
    }
  }

  return (
    <li className={cn('flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5', !p.active && 'bg-surface-muted/40')}>
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted text-muted">
        {p.imageUrl && !brokenImage ? <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover" onError={() => setBrokenImage(true)} /> : <ImageOff className="size-4" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('truncate text-sm font-medium', p.active ? 'text-fg' : 'text-muted')}>{p.name}</span>
          {p.featured && <Badge tone="warning"><Star className="size-3" aria-hidden /> Destaque</Badge>}
          {!p.active && <Badge tone="neutral" dot>Inativo</Badge>}
          {p.active && !p.available && <Badge tone="danger" dot>Esgotado</Badge>}
        </div>
        {p.description && <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{p.description}</p>}
        {groups.length > 0 && (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            <Layers className="size-3 shrink-0" aria-hidden /> {groups.map((g) => g.name).join(', ')}
          </p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold text-fg tabular">{formatCents(p.priceCents)}</span>
      {manage && (
        <>
          <label className="hidden shrink-0 items-center gap-2 md:flex">
            <span className="text-xs text-muted">{p.available ? 'Disponível' : 'Esgotado'}</span>
            <Switch checked={p.available} disabled={availability.isPending || !p.active} onCheckedChange={toggle} aria-label={`${p.name} disponível`} />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações de ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Editar</DropdownMenuItem>
              <DropdownMenuItem className="md:hidden" disabled={!p.active} onSelect={() => toggle(!p.available)}>
                <UtensilsCrossed aria-hidden /> {p.available ? 'Marcar como esgotado' : 'Marcar como disponível'}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}><ArrowUp aria-hidden /> Mover para cima</DropdownMenuItem>
              <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}><ArrowDown aria-hidden /> Mover para baixo</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDeleting(true)} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger"><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      {deleting && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setDeleting(false)}
          title={`Excluir ${p.name}`}
          description="O produto sai do cardápio. Para retirá-lo só por um tempo, prefira marcar como esgotado ou inativo."
          confirmLabel="Excluir produto"
          tone="danger"
          requireReason={false}
          hideNote
          onConfirm={async () => {
            await remove.mutateAsync(p.id)
            toast.success('Produto excluído.')
          }}
        />
      )}
    </li>
  )
}
