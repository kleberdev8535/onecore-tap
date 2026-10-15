import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/form-alert'
import { todayIso } from '@/features/finance/period-utils'
import { ApiError } from '@/services/http'
import { formatCents } from '@/utils/format'
import { receiptMethodLabels, type ReceiptMethod } from './api'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  amountCents: number
  /** Venda de plaquinha não registra data nem observação. */
  withDetails?: boolean
  onConfirm: (input: { method: ReceiptMethod; paidOn?: string; notes?: string }) => Promise<unknown>
}

/**
 * Registro de recebimento confirmado (o dinheiro já entrou na conta da OneCore Business). Não processa
 * pagamento: quando houver integração com o provedor, a confirmação virá dele.
 */
export function ReceiptDialog({ open, onOpenChange, title, amountCents, withDetails = true, onConfirm }: Props) {
  const [method, setMethod] = useState<ReceiptMethod>('PIX')
  const [paidOn, setPaidOn] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const close = (next: boolean) => {
    if (!next) {
      setMethod('PIX')
      setPaidOn(todayIso())
      setNotes('')
      setError(null)
    }
    onOpenChange(next)
  }

  const submit = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm({ method, paidOn: withDetails ? paidOn : undefined, notes: withDetails && notes.trim() ? notes.trim() : undefined })
      toast.success('Recebimento registrado.', { description: formatCents(amountCents) })
      close(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível registrar.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      description={`Confirme somente depois que ${formatCents(amountCents)} estiver na conta. O registro fica na auditoria.`}
      footer={<><Button variant="secondary" onClick={() => close(false)}>Cancelar</Button><Button onClick={submit} loading={pending}>Registrar recebimento</Button></>}
    >
      <FormAlert message={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Como foi recebido">
          <Select value={method} onChange={(e) => setMethod(e.target.value as ReceiptMethod)}>
            {(Object.keys(receiptMethodLabels) as ReceiptMethod[]).map((m) => <option key={m} value={m}>{receiptMethodLabels[m]}</option>)}
          </Select>
        </Field>
        {withDetails && (
          <Field label="Data do recebimento">
            <Input type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
        )}
        {withDetails && (
          <Field label="Observação" hint="Opcional. Ex.: número do comprovante" className="sm:col-span-2">
            <Textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        )}
      </div>
    </Dialog>
  )
}
