import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailPlus, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useInviteOwner, useResendInvite } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { InviteLinkDialog } from '@/features/users/invite-link-dialog'
import { ApiError } from '@/services/http'
import type { Onboarding } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(120),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
})

export function OwnerTab({ restaurantId, onboarding }: { restaurantId: string; onboarding: Onboarding }) {
  const invite = useInviteOwner(restaurantId)
  const resend = useResendInvite()
  const [link, setLink] = useState<{ url: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  })
  const owner = onboarding.owner

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      const result = await invite.mutateAsync(v)
      reset()
      setLink({ url: result.inviteLink, name: result.name })
      toast.success('Proprietário convidado.')
    } catch (e) {
      if (e instanceof ApiError) {
        Object.entries(e.fields).forEach(([f, m]) => setFieldError(f as 'name' | 'email', { message: m }))
        setError(e.message)
      } else setError('Não foi possível enviar o convite.')
    }
  })

  const resendInvite = async () => {
    if (!owner) return
    try {
      const result = await resend.mutateAsync(owner.id)
      setLink({ url: result.inviteLink, name: owner.name })
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível gerar o convite.')
    }
  }

  return (
    <Card className="max-w-2xl">
      {owner ? (
        <>
          <CardHeader><div><CardTitle>Proprietário</CardTitle><CardDescription>Acesso principal do restaurante. Ele cadastra a equipe na Fase 3.</CardDescription></div></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 rounded-xl border border-line p-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-700"><UserRound className="size-5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{owner.name}</p>
                <p className="truncate text-[13px] text-muted">{owner.email}</p>
                <p className="mt-1 text-xs text-muted">{owner.lastLoginAt ? `Último acesso em ${formatDateTime(owner.lastLoginAt)}` : 'Convite pendente: ainda não criou a senha'}</p>
              </div>
              <Badge tone={owner.active ? (owner.lastLoginAt ? 'success' : 'warning') : 'danger'} dot>{owner.active ? (owner.lastLoginAt ? 'Ativo' : 'Pendente') : 'Desativado'}</Badge>
            </div>
            {owner.active && (
              <Button variant="secondary" className="mt-4" onClick={resendInvite} loading={resend.isPending}><MailPlus aria-hidden /> Gerar novo link de acesso</Button>
            )}
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader><div><CardTitle>Convidar proprietário</CardTitle><CardDescription>Ele recebe um link de uso único (72h) para criar a própria senha. Nenhuma senha é definida por aqui.</CardDescription></div></CardHeader>
          <CardContent>
            <FormAlert message={error} />
            <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome completo" error={errors.name?.message}><Input autoComplete="off" {...register('name')} /></Field>
              <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="off" {...register('email')} /></Field>
              <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={invite.isPending}><MailPlus aria-hidden /> Gerar convite</Button></div>
            </form>
          </CardContent>
        </>
      )}
      <InviteLinkDialog link={link?.url ?? null} name={link?.name ?? ''} onClose={() => setLink(null)} />
    </Card>
  )
}
