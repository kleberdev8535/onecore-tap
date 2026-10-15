import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import { formatCents } from '@/utils/format'
import { cartTotal, useCart } from './cart-store'
import { usePlaceOrder } from './public-api'

interface CartSheetProps {
  token: string
  canOrder: boolean
  closedMessage: string | null
  requireConfirmation: boolean
  onClose: () => void
}

export function CartSheet({ token, canOrder, closedMessage, requireConfirmation, onClose }: CartSheetProps) {
  const { lines, setQuantity, remove, clear } = useCart()
  const place = usePlaceOrder(token)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const total = cartTotal(lines)

  const submit = async () => {
    setError(null)
    try {
      const order = await place.mutateAsync({
        customerName: name.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes || undefined, optionIds: l.optionIds })),
      })
      clear()
      onClose()
      navigate(`/t/${token}/pedido/${order.trackingToken}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível enviar o pedido. Tente novamente.')
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Seu pedido"
      description={lines.length ? `${lines.length} ${lines.length === 1 ? 'item' : 'itens'}` : 'Seu carrinho está vazio'}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!lines.length || !canOrder || place.isPending}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-50"
          style={{ backgroundColor: 'var(--m-primary)', color: 'var(--m-on-primary)' }}
        >
          <span>{place.isPending ? 'Enviando...' : canOrder ? 'Enviar pedido' : 'Pedidos indisponíveis agora'}</span>
          <span className="tabular">{formatCents(total)}</span>
        </button>
      }
    >
      <FormAlert message={error ?? closedMessage} />
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.key} className="flex gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-fg">{l.name}</p>
              {l.optionNames.length > 0 && <p className="text-[13px] text-muted">{l.optionNames.join(' · ')}</p>}
              {l.notes && <p className="text-[13px] text-muted">Obs.: {l.notes}</p>}
              <p className="mt-1 text-sm font-semibold text-fg tabular">{formatCents(l.unitPriceCents * l.quantity)}</p>
            </div>
            <div className="flex h-10 shrink-0 items-center self-center rounded-lg border border-line" role="group" aria-label={`Quantidade de ${l.name}`}>
              <button type="button" className="flex size-10 items-center justify-center text-fg-secondary" aria-label={l.quantity === 1 ? `Remover ${l.name}` : 'Diminuir'} onClick={() => (l.quantity === 1 ? remove(l.key) : setQuantity(l.key, l.quantity - 1))}>
                {l.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
              </button>
              <span className="w-5 text-center text-sm font-semibold tabular">{l.quantity}</span>
              <button type="button" className="flex size-10 items-center justify-center text-fg-secondary disabled:opacity-40" aria-label="Aumentar" disabled={l.quantity >= 50} onClick={() => setQuantity(l.key, l.quantity + 1)}><Plus className="size-4" /></button>
            </div>
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="customer-name" className="text-[13px] font-medium text-fg-secondary">Seu nome <span className="font-normal text-muted">(opcional)</span></label>
            <Input id="customer-name" className="mt-1.5" maxLength={60} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Para chamarmos você" />
          </div>
          <div>
            <label htmlFor="order-notes" className="text-[13px] font-medium text-fg-secondary">Observação para o pedido</label>
            <Textarea id="order-notes" className="mt-1.5" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="flex gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] leading-relaxed text-fg-secondary">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            {requireConfirmation ? 'O restaurante confirma o pedido antes de começar o preparo. ' : ''}O valor final é conferido pelo restaurante no envio.
          </p>
        </div>
      )}
    </Dialog>
  )
}
