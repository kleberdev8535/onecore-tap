import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Check, CircleX, FlaskConical, Plus } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import { formatCents, formatDateTime } from '@/utils/format'
import { menuTheme, useMenuTheme } from './menu-logic'
import { MenuUnavailable } from './menu-page'
import { useMenu, useTrackOrder } from './public-api'
import { customerStatus, customerSteps, stepIndex } from './status-steps'
import { TableSheet } from './table-sheet'

/** Acompanhamento do pedido pelo cliente (/t/:token/pedido/:tracking). Atualiza sozinho a cada poucos segundos. */
export function OrderTrackingPage() {
  const { token = '', tracking = '' } = useParams()
  const menu = useMenu(token)
  const order = useTrackOrder(tracking)
  const [tableOpen, setTableOpen] = useState(false)
  useMenuTheme(menu.data)

  if (order.isPending || menu.isPending) {
    return <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-canvas p-5" aria-busy><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></main>
  }
  if (order.isError || !order.data) {
    return <MenuUnavailable message={order.error instanceof ApiError ? order.error.message : 'Não foi possível carregar o pedido.'} />
  }

  const o = order.data
  const r = menu.data?.restaurant
  const status = customerStatus(o.status)
  const current = stepIndex(o.status)
  const cancelled = o.status === 'CANCELLED'

  return (
    <main className="min-h-dvh bg-canvas pb-10" style={r ? menuTheme(r.primaryColor, r.accentColor) : undefined}>
      <header className="px-5 pb-16 pt-6" style={{ backgroundColor: 'var(--m-accent, var(--color-ink))', color: 'var(--m-on-accent, #fff)' }}>
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to={`/t/${token}`} className="inline-flex items-center gap-1.5 text-sm font-medium opacity-90"><ArrowLeft className="size-4" aria-hidden /> Cardápio</Link>
          <span className="text-sm opacity-90">Mesa {o.tableLabel}</span>
        </div>
        <div className="mx-auto mt-6 max-w-md">
          <p className="text-sm opacity-80">{r?.tradeName} · Pedido #{String(o.number).padStart(4, '0')}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight" aria-live="polite">{status.label}</h1>
          <p className="mt-1 text-[15px] opacity-90">{status.hint}</p>
        </div>
      </header>

      <div className="mx-auto -mt-10 flex max-w-md flex-col gap-4 px-4">
        {o.test && <p className="flex items-center gap-2 rounded-xl bg-info-soft px-4 py-3 text-[13px] font-medium text-info"><FlaskConical className="size-4" aria-hidden /> Pedido de teste da implantação.</p>}

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card" aria-label="Andamento do pedido">
          {cancelled ? (
            <p className="flex items-center gap-3 text-[15px] text-danger"><CircleX className="size-5" aria-hidden /> Este pedido foi cancelado pelo restaurante.</p>
          ) : (
            <ol className="flex flex-col">
              {customerSteps.map((step, i) => {
                const done = i < current || o.status === 'COMPLETED'
                const active = i === current && o.status !== 'COMPLETED'
                return (
                  <li key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < customerSteps.length - 1 && <span className={cn('absolute left-[11px] top-6 h-[calc(100%-16px)] w-0.5', done ? '' : 'bg-line')} style={done ? { backgroundColor: 'var(--m-primary)' } : undefined} aria-hidden />}
                    <span
                      className={cn('relative flex size-6 shrink-0 items-center justify-center rounded-full border-2', !done && !active && 'border-line bg-surface')}
                      style={done || active ? { borderColor: 'var(--m-primary)', backgroundColor: done ? 'var(--m-primary)' : 'var(--color-surface)', color: 'var(--m-on-primary)' } : undefined}
                      aria-hidden
                    >
                      {done && <Check className="size-3.5" strokeWidth={3} />}
                      {active && <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--m-primary)' }} />}
                    </span>
                    <div>
                      <p className={cn('text-[15px]', active ? 'font-semibold text-fg' : done ? 'text-fg' : 'text-muted')}>{step.label}</p>
                      {active && <p className="text-[13px] text-muted">{step.hint}</p>}
                    </div>
                    <span className="sr-only">{done ? 'concluída' : active ? 'etapa atual' : 'pendente'}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface shadow-card" aria-label="Itens do pedido">
          <ul className="divide-y divide-line">
            {o.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[15px] text-fg"><span className="mr-1.5 text-muted tabular">{item.quantity}x</span>{item.productName}</p>
                  {item.options.length > 0 && <p className="text-[13px] text-muted">{item.options.map((op) => op.optionName).join(' · ')}</p>}
                  {item.notes && <p className="text-[13px] text-muted">Obs.: {item.notes}</p>}
                </div>
                <span className="shrink-0 text-sm font-medium text-fg tabular">{formatCents(item.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
            <span className="text-sm text-muted">Total · {formatDateTime(o.createdAt)}</span>
            <span className={cn('text-lg font-semibold tabular', cancelled ? 'text-muted line-through' : 'text-fg')}>{formatCents(o.totalCents)}</span>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Link to={`/t/${token}`} className="flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold" style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' }}>
            <Plus className="size-4" aria-hidden /> Pedir mais
          </Link>
          <button type="button" onClick={() => setTableOpen(true)} className="h-12 rounded-xl border border-line bg-surface text-[15px] font-semibold text-fg">Minha mesa</button>
        </div>
        <p className="text-center text-xs text-muted">Esta página atualiza sozinha. Pode deixá-la aberta.</p>
        <div className="mt-6 flex justify-center opacity-50"><Logo /></div>
      </div>
      {tableOpen && <TableSheet token={token} tableLabel={o.tableLabel} onClose={() => setTableOpen(false)} />}
    </main>
  )
}
