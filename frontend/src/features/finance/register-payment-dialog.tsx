import { useState } from 'react'
import { Banknote, CreditCard, Plus, QrCode, Trash2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import { formatCents, parseCents } from '@/utils/format'
import { paymentMethodLabels, useRegisterPayment, type PaymentMethod, type RegisterPaymentInput } from './api'

const methodIcons: Record<PaymentMethod, LucideIcon> = { PIX: QrCode, CASH: Banknote, CARD: CreditCard }
const methods: PaymentMethod[] = ['PIX', 'CARD', 'CASH']

interface Part {
  method: PaymentMethod
  amount: string
  received: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  totalCents: number
  target: Pick<RegisterPaymentInput, 'scope' | 'orderIds' | 'tableId'>
}

const toInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

/**
 * Registro operacional do pagamento: a equipe confirma o que recebeu. Não processa cobrança e não coleta dados
 * de cartão (só o método). Pode dividir em até 4 partes; a soma precisa fechar com o total.
 */
export function RegisterPaymentDialog({ open, onOpenChange, title, description, totalCents, target }: Props) {
  const register = useRegisterPayment()
  const [parts, setParts] = useState<Part[]>([{ method: 'PIX', amount: toInput(totalCents), received: '' }])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const amounts = parts.map((p) => parseCents(p.amount))
  const sum = amounts.reduce<number>((a, b) => a + (b ?? 0), 0)
  const remaining = totalCents - sum
  const invalidAmount = amounts.some((a) => a === null || a <= 0)
  const cashIssues = parts.some((p, i) => p.method === 'CASH' && p.received.trim() !== '' && (parseCents(p.received) ?? -1) < (amounts[i] ?? 0))
  const canSubmit = !invalidAmount && remaining === 0 && !cashIssues

  const close = (next: boolean) => {
    if (!next) {
      setParts([{ method: 'PIX', amount: toInput(totalCents), received: '' }])
      setNotes('')
      setError(null)
    }
    onOpenChange(next)
  }

  const update = (i: number, patch: Partial<Part>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const addPart = () =>
    setParts((ps) => [...ps, { method: ps.some((p) => p.method === 'CASH') ? 'CARD' : 'CASH', amount: toInput(Math.max(remaining, 0)), received: '' }])

  const submit = async () => {
    if (!canSubmit) return
    setError(null)
    try {
      await register.mutateAsync({
        ...target,
        notes: notes.trim() || undefined,
        entries: parts.map((p, i) => ({
          method: p.method,
          amountCents: amounts[i]!,
          receivedCents: p.method === 'CASH' && p.received.trim() ? parseCents(p.received) ?? undefined : undefined,
        })),
      })
      toast.success('Pagamento registrado.', { description: formatCents(totalCents) })
      close(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível registrar o pagamento.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>Cancelar</Button>
          <Button onClick={submit} loading={register.isPending} disabled={!canSubmit}>Registrar {formatCents(totalCents)}</Button>
        </>
      }
    >
      <FormAlert message={error} />
      <div className="mb-4 flex items-baseline justify-between rounded-lg bg-surface-muted px-4 py-3">
        <span className="text-sm text-fg-secondary">Total a receber</span>
        <span className="text-xl font-semibold text-fg tabular">{formatCents(totalCents)}</span>
      </div>

      <ul className="flex flex-col gap-3">
        {parts.map((p, i) => {
          const amount = amounts[i]
          const received = p.method === 'CASH' && p.received.trim() ? parseCents(p.received) : null
          const change = received !== null && amount !== null ? received - amount : null
          return (
            <li key={i} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <div role="radiogroup" aria-label={`Método da parte ${i + 1}`} className="flex gap-1.5">
                  {methods.map((m) => {
                    const Icon = methodIcons[m]
                    const checked = p.method === m
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => update(i, { method: m, received: '' })}
                        className={cn(
                          'inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors',
                          checked ? 'border-brand bg-brand-50 text-brand-700' : 'border-line text-fg-secondary hover:border-line-strong',
                        )}
                      >
                        <Icon className="size-4" aria-hidden /> {paymentMethodLabels[m]}
                      </button>
                    )
                  })}
                </div>
                {parts.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover parte ${i + 1}`} onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-fg-secondary">
                  Valor (R$)
                  <Input inputMode="decimal" value={p.amount} invalid={amount === null || (amount ?? 0) <= 0} onChange={(e) => update(i, { amount: e.target.value })} />
                </label>
                {p.method === 'CASH' && (
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-fg-secondary">
                    Recebido (opcional)
                    <Input inputMode="decimal" placeholder="Para calcular o troco" value={p.received} invalid={change !== null && change < 0} onChange={(e) => update(i, { received: e.target.value })} />
                  </label>
                )}
              </div>
              {change !== null && (
                <p className={cn('mt-2 text-[13px]', change < 0 ? 'text-danger' : 'text-fg-secondary')}>
                  {change < 0 ? 'Valor recebido menor que o da parte.' : `Troco: ${formatCents(change)}`}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        {parts.length < 4 ? (
          <Button type="button" variant="ghost" size="sm" onClick={addPart}><Plus aria-hidden /> Dividir em outro método</Button>
        ) : <span />}
        <p className={cn('text-[13px] font-medium tabular', remaining === 0 ? 'text-success' : 'text-warning')} aria-live="polite">
          {remaining === 0 ? 'Valores conferem' : remaining > 0 ? `Faltam ${formatCents(remaining)}` : `Excedeu ${formatCents(-remaining)}`}
        </p>
      </div>

      <label className="mt-4 flex flex-col gap-1.5 text-[13px] font-medium text-fg-secondary">
        Observação (opcional)
        <Textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <p className="mt-3 text-xs text-muted">Registro do que a equipe recebeu. Não processa cobranças nem guarda dados de cartão.</p>
    </Dialog>
  )
}
