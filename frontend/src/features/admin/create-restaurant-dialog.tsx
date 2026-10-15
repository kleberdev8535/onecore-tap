import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import { useCreateRestaurant } from './api'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

const digits = (v: string) => v.replace(/\D/g, '')

const schema = z.object({
  tradeName: z.string().trim().min(2, 'Informe o nome comercial').max(120),
  legalName: z.string().trim().max(160).optional(),
  cnpj: z
    .string()
    .transform(digits)
    .refine((v) => v === '' || v.length === 14, 'CNPJ deve ter 14 dígitos'),
  email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido'),
  phone: z
    .string()
    .transform(digits)
    .refine((v) => v === '' || v.length === 10 || v.length === 11, 'Informe DDD + número'),
  city: z.string().trim().max(100).optional(),
  state: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

const empty = (v?: string) => (v && v.trim() ? v.trim() : undefined)

export function CreateRestaurantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateRestaurant()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { tradeName: '', legalName: '', cnpj: '', email: '', phone: '', city: '', state: '' },
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset()
      setFormError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      const created = await create.mutateAsync({
        tradeName: v.tradeName,
        legalName: empty(v.legalName),
        cnpj: empty(v.cnpj),
        email: empty(v.email),
        phone: empty(v.phone),
        city: empty(v.city),
        state: empty(v.state),
      })
      toast.success(`${created.tradeName} cadastrado`, { description: 'O restaurante está em implantação.' })
      handleOpenChange(false)
      navigate(`/admin/restaurantes/${created.id}`)
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fields).forEach(([field, message]) =>
          setError(field as keyof FormInput, { message }),
        )
        setFormError(error.message)
      } else {
        setFormError('Não foi possível cadastrar. Tente novamente.')
      }
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Novo restaurante"
      description="Dados comerciais iniciais. Identidade visual, plano e usuário proprietário entram nas próximas etapas da implantação."
      footer={
        <>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="create-restaurant" loading={create.isPending}>
            Cadastrar restaurante
          </Button>
        </>
      }
    >
      <FormAlert message={formError} />
      <form id="create-restaurant" onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome comercial" error={errors.tradeName?.message} className="sm:col-span-2">
          <Input placeholder="Ex.: Burger House" autoFocus {...register('tradeName')} />
        </Field>
        <Field label="Razão social" hint="Opcional" error={errors.legalName?.message} className="sm:col-span-2">
          <Input {...register('legalName')} />
        </Field>
        <Field label="CNPJ" hint="Opcional, somente números" error={errors.cnpj?.message}>
          <Input inputMode="numeric" placeholder="00.000.000/0000-00" {...register('cnpj')} />
        </Field>
        <Field label="Telefone" hint="Opcional, com DDD" error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" placeholder="(11) 99999-0000" {...register('phone')} />
        </Field>
        <Field label="E-mail comercial" hint="Opcional" error={errors.email?.message} className="sm:col-span-2">
          <Input type="email" inputMode="email" placeholder="contato@restaurante.com.br" {...register('email')} />
        </Field>
        <Field label="Cidade" error={errors.city?.message}>
          <Input {...register('city')} />
        </Field>
        <Field label="UF" error={errors.state?.message}>
          <Select {...register('state')}>
            <option value="">Selecione</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  )
}
