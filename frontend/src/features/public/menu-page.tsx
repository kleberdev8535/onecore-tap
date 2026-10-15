import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ChevronDown, CircleAlert, FlaskConical, ImageOff, MapPin, Phone, Search, ShoppingBag, Star, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/logo'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/http'
import type { PublicMenu, PublicMenuProduct } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'
import { CartSheet } from './cart-sheet'
import { cartCount, cartTotal, useCart } from './cart-store'
import { menuTheme, useMenuTheme, weekdayNames } from './menu-logic'
import { ProductSheet } from './product-sheet'
import { useMenu } from './public-api'
import { TableSheet } from './table-sheet'

export function MenuUnavailable({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted"><CircleAlert className="size-6" aria-hidden /></span>
      <h1 className="mt-5 text-xl font-semibold text-fg">Mesa indisponível</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">{message}</p>
      <div className="mt-10 opacity-70"><Logo /></div>
    </main>
  )
}

/**
 * Cardápio aberto pelo NFC ou QR Code da mesa (/t/:token). Mobile first; o restaurante e a mesa vêm da plaquinha,
 * e o pedido é calculado e validado pelo servidor.
 */
export function MenuPage() {
  const { token = '' } = useParams()
  const menu = useMenu(token)
  const loadCart = useCart((s) => s.load)
  useEffect(() => loadCart(token), [loadCart, token])
  useMenuTheme(menu.data)

  if (menu.isPending) {
    return (
      <main className="min-h-dvh bg-canvas" aria-busy>
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      </main>
    )
  }
  if (menu.isError || !menu.data) {
    return <MenuUnavailable message={menu.error instanceof ApiError ? menu.error.message : 'Não foi possível abrir o cardápio. Chame um atendente.'} />
  }
  return <MenuContent menu={menu.data} token={token} />
}

function MenuContent({ menu, token }: { menu: PublicMenu; token: string }) {
  const r = menu.restaurant
  const lines = useCart((s) => s.lines)
  const [search, setSearch] = useState('')
  const [product, setProduct] = useState<PublicMenuProduct | null>(null)
  const [sheet, setSheet] = useState<'cart' | 'table' | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(menu.menu.categories[0]?.id ?? null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const chipsRef = useRef<HTMLDivElement>(null)

  const canOrder = menu.openNow || menu.preview
  const closedMessage = canOrder ? null : 'O restaurante está fechado agora. Você pode ver o cardápio, mas os pedidos abrem no horário de funcionamento.'
  const term = search.trim().toLowerCase()
  const featured = useMemo(() => menu.menu.categories.flatMap((c) => c.products).filter((p) => p.featured && p.available), [menu])
  const sections = useMemo(
    () =>
      menu.menu.categories
        .map((c) => ({ ...c, products: term ? c.products.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(term)) : c.products }))
        .filter((c) => c.products.length > 0),
    [menu, term],
  )

  // Marca a categoria visível enquanto o cliente rola a página.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveCategory(visible.target.getAttribute('data-category'))
      },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    sectionRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-chip="${activeCategory}"]`)
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeCategory])

  const goTo = (id: string) => {
    const el = sectionRefs.current.get(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 112
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const count = cartCount(lines)
  const groups = menu.menu.addonGroups

  return (
    <main className="min-h-dvh bg-canvas pb-28" style={menuTheme(r.primaryColor, r.accentColor)}>
      {menu.preview && (
        <div className="flex items-center justify-center gap-2 bg-info-soft px-4 py-2 text-[13px] font-medium text-info">
          <FlaskConical className="size-4" aria-hidden /> Modo de teste: restaurante em implantação. Pedidos ficam marcados como teste.
        </div>
      )}

      <header className="relative overflow-hidden" style={{ backgroundColor: 'var(--m-accent)', color: 'var(--m-on-accent)' }}>
        {r.coverImageUrl && (
          <>
            <img src={r.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 opacity-75" style={{ backgroundColor: 'var(--m-accent)' }} aria-hidden />
          </>
        )}
        <div className="relative mx-auto max-w-2xl px-4 pb-6 pt-8">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-2xl font-semibold shadow-card" style={{ color: 'var(--m-accent)' }}>
              {r.logoUrl ? <img src={r.logoUrl} alt={`Logotipo ${r.tradeName}`} className="size-full object-cover" /> : r.tradeName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold leading-tight tracking-tight">{r.tradeName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm opacity-90">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold ring-1 ring-inset ring-white/25">Mesa {menu.tableLabel}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', menu.openNow ? 'bg-success' : 'bg-danger')} aria-hidden />
                  {menu.openNow ? 'Aberto agora' : 'Fechado agora'}
                </span>
              </p>
            </div>
          </div>
          {r.description && <p className="mt-4 text-[15px] leading-relaxed opacity-90">{r.description}</p>}
          <RestaurantInfo menu={menu} />
        </div>
      </header>

      {closedMessage && <p className="mx-auto max-w-2xl px-4 pt-4 text-[13px] font-medium text-warning">{closedMessage}</p>}

      <div className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <label htmlFor="menu-search" className="sr-only">Buscar no cardápio</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="menu-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-base text-fg placeholder:text-muted focus-visible:border-[var(--m-primary)] focus-visible:outline-none"
            />
          </div>
        </div>
        {!term && (
          <nav aria-label="Categorias" ref={chipsRef} className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
            {menu.menu.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                data-chip={c.id}
                onClick={() => goTo(c.id)}
                aria-current={activeCategory === c.id ? 'true' : undefined}
                className="h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors"
                style={activeCategory === c.id ? { backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' } : { backgroundColor: 'var(--color-surface)', color: 'var(--color-fg-secondary)', boxShadow: 'inset 0 0 0 1px var(--color-line)' }}
              >
                {c.name}
              </button>
            ))}
          </nav>
        )}
        {term && <p className="mx-auto max-w-2xl px-4 py-3 text-[13px] text-muted">{sections.reduce((n, s) => n + s.products.length, 0)} resultados para "{search.trim()}"</p>}
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {menu.menu.categories.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <UtensilsCrossed className="size-8 text-muted" aria-hidden />
            <p className="mt-3 text-[15px] font-medium text-fg">Cardápio em preparação</p>
            <p className="mt-1 text-sm text-muted">Chame um atendente para fazer seu pedido.</p>
          </div>
        )}

        {!term && featured.length > 0 && (
          <section className="pt-5" aria-labelledby="featured-title">
            <h2 id="featured-title" className="flex items-center gap-2 text-lg font-semibold text-fg"><Star className="size-4" style={{ color: 'var(--m-ink)' }} aria-hidden /> Destaques</h2>
            <ul className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {featured.map((p) => (
                <li key={p.id} className="w-40 shrink-0">
                  <button type="button" onClick={() => setProduct(p)} className="w-full overflow-hidden rounded-xl border border-line bg-surface text-left shadow-card">
                    <div className="aspect-[4/3] bg-surface-muted">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-muted"><ImageOff className="size-5" aria-hidden /></div>}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-fg">{p.name}</p>
                      <p className="mt-1 text-sm font-semibold tabular" style={{ color: 'var(--m-ink)' }}>{formatCents(p.priceCents)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {term && sections.length === 0 && <p className="py-12 text-center text-sm text-muted">Nada encontrado. Tente outro termo.</p>}

        {sections.map((c) => (
          <section
            key={c.id}
            data-category={c.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(c.id, el)
              else sectionRefs.current.delete(c.id)
            }}
            className="pt-7"
            aria-labelledby={`cat-${c.id}`}
          >
            <h2 id={`cat-${c.id}`} className="text-lg font-semibold text-fg">{c.name}</h2>
            {c.description && <p className="mt-0.5 text-sm text-muted">{c.description}</p>}
            <ul className="mt-2 divide-y divide-line">
              {c.products.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setProduct(p)} className={cn('flex w-full gap-4 py-4 text-left', !p.available && 'opacity-55')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-fg">{p.name}</p>
                      {p.description && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{p.description}</p>}
                      <p className="mt-2 text-[15px] font-semibold tabular" style={{ color: p.available ? 'var(--m-ink)' : undefined }}>
                        {p.available ? formatCents(p.priceCents) : 'Esgotado'}
                      </p>
                    </div>
                    {p.imageUrl && (
                      <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                        <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-12 flex justify-center opacity-50"><Logo /></div>
      </div>

      {/* Barra inferior: mesa à esquerda, pedido à direita. Área segura do iPhone respeitada. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button type="button" onClick={() => setSheet('table')} className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-fg">
            Mesa {menu.tableLabel} <ChevronDown className="size-4 -rotate-90 text-muted" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSheet('cart')}
            disabled={count === 0}
            className="flex h-12 flex-1 items-center justify-between gap-3 rounded-xl px-4 text-[15px] font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' }}
          >
            <span className="flex items-center gap-2"><ShoppingBag className="size-4" aria-hidden /> {count === 0 ? 'Seu pedido está vazio' : `Ver pedido · ${count} ${count === 1 ? 'item' : 'itens'}`}</span>
            {count > 0 && <span className="tabular">{formatCents(cartTotal(lines))}</span>}
          </button>
        </div>
      </div>

      {product && (
        <ProductSheet key={product.id} product={product} groups={groups} canOrder={canOrder} onClose={() => setProduct(null)} onAdded={(name) => toast.success(`${name} adicionado ao pedido.`)} />
      )}
      {sheet === 'cart' && <CartSheet token={token} canOrder={canOrder} closedMessage={closedMessage} requireConfirmation={menu.requireOrderConfirmation} onClose={() => setSheet(null)} />}
      {sheet === 'table' && <TableSheet token={token} tableLabel={menu.tableLabel} onClose={() => setSheet(null)} />}
    </main>
  )
}

function RestaurantInfo({ menu }: { menu: PublicMenu }) {
  const r = menu.restaurant
  const address = [r.addressLine, [r.city, r.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ')
  if (!address && !r.phone && menu.openingHours.length === 0) return null
  const byDay = weekdayNames.map((name, i) => ({ name, ranges: menu.openingHours.filter((h) => h.weekday === i + 1) }))
  return (
    <details className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm ring-1 ring-inset ring-white/20">
      <summary className="cursor-pointer font-medium">Horários e informações</summary>
      <div className="mt-3 flex flex-col gap-3 opacity-95">
        {menu.openingHours.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {byDay.map((d) => (
              <div key={d.name} className="contents">
                <dt>{d.name}</dt>
                <dd className="tabular">{d.ranges.length ? d.ranges.map((h) => `${h.opensAt.slice(0, 5)} às ${h.closesAt.slice(0, 5)}`).join(', ') : 'Fechado'}</dd>
              </div>
            ))}
          </dl>
        )}
        {address && <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {address}</p>}
        {r.phone && <p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden /> <a href={`tel:${r.phone}`} className="underline underline-offset-2">{r.phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}</a></p>}
      </div>
    </details>
  )
}
