import { useMemo, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { PublicMenuGroup, PublicMenuProduct } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'
import { useCart } from './cart-store'
import { estimateUnit, groupStatus, ruleLabel, toggleOption } from './menu-logic'

interface ProductSheetProps {
  product: PublicMenuProduct
  groups: PublicMenuGroup[]
  canOrder: boolean
  onClose: () => void
  onAdded: (name: string) => void
}

/** Montada a cada produto aberto (key): escolhas sempre começam do zero. */
export function ProductSheet({ product, groups, canOrder, onClose, onAdded }: ProductSheetProps) {
  const add = useCart((s) => s.add)
  const productGroups = useMemo(
    () => product.addonGroupIds.map((id) => groups.find((g) => g.id === id)).filter((g): g is PublicMenuGroup => Boolean(g)),
    [product, groups],
  )
  const [selected, setSelected] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const status = groupStatus(productGroups, selected)
  const missing = status.find((s) => s.missing > 0)
  const unit = estimateUnit(product.priceCents, productGroups, selected)
  const orderable = canOrder && product.available

  const submit = () => {
    if (missing || !orderable) return
    const options = productGroups.flatMap((g) => g.options).filter((o) => selected.includes(o.id))
    add({
      productId: product.id,
      name: product.name,
      optionIds: options.map((o) => o.id),
      optionNames: options.map((o) => o.name),
      notes: notes.trim(),
      quantity,
      unitPriceCents: unit,
    })
    onAdded(product.name)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={product.name}
      description={product.available ? undefined : 'Indisponível no momento'}
      footer={
        <div className="flex w-full items-center gap-3">
          <div className="flex h-12 items-center rounded-xl border border-line bg-surface" role="group" aria-label="Quantidade">
            <button type="button" className="flex size-12 items-center justify-center text-fg-secondary disabled:opacity-40" aria-label="Diminuir quantidade" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}><Minus className="size-4" /></button>
            <span className="w-6 text-center text-base font-semibold tabular" aria-live="polite">{quantity}</span>
            <button type="button" className="flex size-12 items-center justify-center text-fg-secondary disabled:opacity-40" aria-label="Aumentar quantidade" disabled={quantity >= 50} onClick={() => setQuantity((q) => q + 1)}><Plus className="size-4" /></button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={Boolean(missing) || !orderable}
            className="flex h-12 flex-1 items-center justify-between gap-3 rounded-xl px-4 text-[15px] font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' }}
          >
            <span className="truncate">{!orderable ? 'Indisponível' : missing ? `Escolha ${missing.group.name.toLowerCase()}` : 'Adicionar'}</span>
            <span className="tabular">{formatCents(unit * quantity)}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {product.imageUrl && (
          <div className="-mx-6 -mt-5 aspect-[16/10] overflow-hidden bg-surface-muted">
            <img src={product.imageUrl} alt="" className="size-full object-cover" />
          </div>
        )}
        <div>
          {product.description && <p className="text-[15px] leading-relaxed text-fg-secondary">{product.description}</p>}
          <p className="mt-2 text-lg font-semibold tabular" style={{ color: 'var(--m-ink)' }}>{formatCents(product.priceCents)}</p>
        </div>

        {status.map(({ group, count, missing: lack }) => (
          <fieldset key={group.id}>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
              <legend className="text-[15px] font-semibold text-fg">{group.name}</legend>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', lack > 0 ? 'bg-ink text-white' : 'bg-surface text-muted')}>
                {lack > 0 ? ruleLabel(group) : count > 0 ? <span className="inline-flex items-center gap-1"><Check className="size-3" aria-hidden /> {ruleLabel(group).split(' · ')[0]}</span> : ruleLabel(group)}
              </span>
            </div>
            <ul className="mt-1 divide-y divide-line">
              {group.options.map((o) => {
                const checked = selected.includes(o.id)
                const single = group.maxChoices === 1
                const blocked = !checked && !single && count >= group.maxChoices
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role={single ? 'radio' : 'checkbox'}
                      aria-checked={checked}
                      disabled={!o.available || blocked}
                      onClick={() => setSelected((s) => toggleOption(group, s, o.id))}
                      className="flex min-h-12 w-full items-center gap-3 px-1 py-2.5 text-left disabled:opacity-45"
                    >
                      <span
                        className={cn('flex size-5 shrink-0 items-center justify-center border-2', single ? 'rounded-full' : 'rounded-md', checked ? 'border-transparent' : 'border-line-strong')}
                        style={checked ? { backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' } : undefined}
                        aria-hidden
                      >
                        {checked && (single ? <span className="size-2 rounded-full bg-current" /> : <Check className="size-3.5" strokeWidth={3} />)}
                      </span>
                      <span className="flex-1 text-[15px] text-fg">{o.name}{!o.available && <span className="ml-2 text-xs text-muted">Esgotado</span>}</span>
                      <span className="text-sm text-muted tabular">{o.priceCents ? `+ ${formatCents(o.priceCents)}` : ''}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ))}

        <div>
          <label htmlFor="item-notes" className="text-[13px] font-medium text-fg-secondary">Alguma observação?</label>
          <Textarea id="item-notes" rows={2} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: sem cebola, ponto da carne" className="mt-1.5" />
        </div>
      </div>
    </Dialog>
  )
}
