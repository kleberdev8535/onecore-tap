import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/services/http'
import { AuthLayout } from './auth-layout'
import { FormAlert } from './form-alert'
import { useLogin } from './api'
import { safeNextPath } from './home-path'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const me = await login.mutateAsync(values)
      navigate(safeNextPath(params.get('next'), me), { replace: true })
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível entrar. Tente novamente.')
    }
  })

  return (
    <AuthLayout title="Entrar na OneCore Tap" description="Acesse o painel do seu restaurante ou a gestão da plataforma.">
      {params.get('sessao') === 'expirada' && !formError && (
        <FormAlert tone="danger" message="Sua sessão expirou. Entre novamente para continuar." />
      )}
      <FormAlert message={formError} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="E-mail" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="nome@restaurante.com.br"
            leading={<Mail />}
            autoFocus
            {...register('email')}
          />
        </Field>

        <Field
          label="Senha"
          error={errors.password?.message}
          labelAside={
            <Link to="/esqueci-senha" className="text-[13px] font-medium text-brand-700 hover:underline">
              Esqueci a senha
            </Link>
          }
        >
          <Input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            leading={<LockKeyhole />}
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            }
            {...register('password')}
          />
        </Field>

        <Button type="submit" size="lg" loading={login.isPending} className="group mt-1 w-full">
          Entrar
          <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </Button>
      </form>

      <p className="mt-8 text-center text-[13px] leading-relaxed text-muted">
        Ainda não tem acesso? Os acessos são criados pela equipe OneCore Business durante a implantação do seu
        estabelecimento.
      </p>
    </AuthLayout>
  )
}
