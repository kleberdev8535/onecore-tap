import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'

interface ReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  tone?: 'primary' | 'danger'
  /** Motivo obrigatorio (acoes sensiveis sempre registram o porque na auditoria). */
  requireReason?: boolean
  /** Confirmação simples, sem campo de observação. */
  hideNote?: boolean
  children?: ReactNode
  onConfirm: (reason: string) => Promise<unknown>
}

/** Confirmacao padronizada para acoes sensiveis, substitui alertas nativos do navegador. */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  requireReason = true,
  hideNote = false,
  children,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string>()
  const [pending, setPending] = useState(false)

  const close = (next: boolean) => {
    if (!next) {
      setReason('')
      setError(null)
      setFieldError(undefined)
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (requireReason && !reason.trim()) {
      setFieldError('Informe o motivo')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onConfirm(reason.trim())
      close(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      setPending(false)
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
          <Button variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <FormAlert message={error} />
      {children}
      {(requireReason || (children == null && !hideNote)) && (
        <Field label={requireReason ? 'Motivo' : 'Observação (opcional)'} error={fieldError} hint="Fica registrado no histórico e na auditoria.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
        </Field>
      )}
    </Dialog>
  )
}
