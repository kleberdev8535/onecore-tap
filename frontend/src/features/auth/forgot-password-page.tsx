import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/services/http'
import { AuthLayout } from './auth-layout'
import { FormAlert } from './form-alert'
import { useForgotPassword } from './api'
import { forgotSchema, type ForgotValues } from './schemas'

export function ForgotPasswordPage() {
  const forgot = useForgotPassword()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await forgot.mutateAsync({ email })
      setSentTo(email)
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível enviar. Tente novamente.')
    }
  })

  if (sentTo) {
    return (
      <AuthLayout title="Verifique seu e-mail" description="Se houver um acesso ativo para este endereço, enviaremos as instruções.">
        <div className="flex gap-3 rounded-xl border border-line bg-surface-muted p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
          <p className="text-sm leading-relaxed text-fg-secondary">
            Enviamos um link para <strong className="font-semibold text-fg">{sentTo}</strong>. Ele expira em 30
            minutos. Confira também a caixa de spam.
          </p>
        </div>
        <Button asChild variant="secondary" size="lg" className="mt-6 w-full">
          <Link to="/login">
            <ArrowLeft aria-hidden /> Voltar para o login
          </Link>
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Redefinir senha" description="Informe o e-mail do seu acesso e enviaremos um link seguro para criar uma nova senha.">
      <FormAlert message={formError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" placeholder="nome@restaurante.com.br" leading={<Mail />} autoFocus {...register('email')} />
        </Field>
        <Button type="submit" size="lg" loading={forgot.isPending} className="w-full">
          Enviar link de redefinição
        </Button>
      </form>
      <Button asChild variant="ghost" className="mt-4 w-full">
        <Link to="/login">
          <ArrowLeft aria-hidden /> Voltar para o login
        </Link>
      </Button>
    </AuthLayout>
  )
}
