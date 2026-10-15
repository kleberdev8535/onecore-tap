import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearchParams } from 'react-router'
import { ArrowRight, CircleCheck, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/services/http'
import { AuthLayout } from './auth-layout'
import { FormAlert } from './form-alert'
import { useResetPassword } from './api'
import { resetSchema, type ResetValues } from './schemas'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const isInvite = params.get('convite') === '1'
  const reset = useResetPassword()
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { newPassword: '', confirm: '' } })

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    if (!token) return
    setFormError(null)
    try {
      await reset.mutateAsync({ token, newPassword })
      setDone(true)
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível redefinir. Tente novamente.')
    }
  })

  if (!token) {
    return (
      <AuthLayout title="Link incompleto" description="Este endereço não contem um token de redefinição válido.">
        <Button asChild size="lg" className="w-full">
          <Link to="/esqueci-senha">Solicitar novo link</Link>
        </Button>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title={isInvite ? 'Acesso criado' : 'Senha atualizada'} description={isInvite ? 'Sua senha foi criada. Entre para acessar o painel do restaurante.' : 'Sua nova senha já está valendo. Use-a para entrar.'}>
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CircleCheck className="size-4" aria-hidden /> Redefinição concluída com sucesso.
        </div>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">
            Ir para o login <ArrowRight aria-hidden />
          </Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={isInvite ? 'Crie sua senha de acesso' : 'Criar nova senha'} description={isInvite ? 'Bem-vindo à OneCore Tap. Use pelo menos 10 caracteres, com letras e números.' : 'Use pelo menos 10 caracteres, com letras e números.'}>
      <FormAlert message={formError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Nova senha" error={errors.newPassword?.message}>
          <Input type="password" autoComplete="new-password" leading={<LockKeyhole />} autoFocus {...register('newPassword')} />
        </Field>
        <Field label="Confirme a nova senha" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" leading={<LockKeyhole />} {...register('confirm')} />
        </Field>
        <Button type="submit" size="lg" loading={reset.isPending} className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  )
}
