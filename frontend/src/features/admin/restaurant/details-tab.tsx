import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useUpdateDetails } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { RestaurantDetail } from '@/types/api'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const digits = (v: string) => v.replace(/\D/g, '')
const optDigits = (len: number[], msg: string) => z.string().transform(digits).refine((v) => v === '' || len.includes(v.length), msg)

const schema = z.object({
  tradeName: z.string().trim().min(2, 'Informe o nome comercial').max(120),
  legalName: z.string().max(160),
  cnpj: optDigits([14], 'CNPJ deve ter 14 dígitos'),
  email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido'),
  phone: optDigits([10, 11], 'Informe DDD + número'),
  addressLine: z.string().max(200),
  city: z.string().max(100),
  state: z.string(),
  postalCode: optDigits([8], 'CEP deve ter 8 dígitos'),
})
type In = z.input<typeof schema>
type Out = z.output<typeof schema>
const opt = (v: string) => (v.trim() ? v.trim() : undefined)

export function DetailsTab({ restaurant: r }: { restaurant: RestaurantDetail }) {
  const save = useUpdateDetails(r.id)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isDirty } } = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    values: {
      tradeName: r.tradeName,
      legalName: r.legalName ?? '',
      cnpj: r.cnpj ?? '',
      email: r.email ?? '',
      phone: r.phone ?? '',
      addressLine: r.addressLine ?? '',
      city: r.city ?? '',
      state: r.state ?? '',
      postalCode: r.postalCode ?? '',
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await save.mutateAsync({
        tradeName: v.tradeName,
        legalName: opt(v.legalName),
        cnpj: opt(v.cnpj),
        email: opt(v.email),
        phone: opt(v.phone),
        addressLine: opt(v.addressLine),
        city: opt(v.city),
        state: opt(v.state),
        postalCode: opt(v.postalCode),
      })
      toast.success('Dados comerciais salvos.')
    } catch (e) {
      if (e instanceof ApiError) {
        Object.entries(e.fields).forEach(([f, m]) => setFieldError(f as keyof In, { message: m }))
        setError(e.message)
      } else setError('Não foi possível salvar.')
    }
  })

  return (
    <Card className="max-w-3xl">
      <CardContent className="p-6">
        <FormAlert message={error} />
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome comercial" error={errors.tradeName?.message} className="sm:col-span-2"><Input {...register('tradeName')} /></Field>
          <Field label="Razão social" error={errors.legalName?.message} className="sm:col-span-2"><Input {...register('legalName')} /></Field>
          <Field label="CNPJ" error={errors.cnpj?.message}><Input inputMode="numeric" {...register('cnpj')} /></Field>
          <Field label="Telefone" error={errors.phone?.message}><Input type="tel" inputMode="tel" {...register('phone')} /></Field>
          <Field label="E-mail comercial" error={errors.email?.message} className="sm:col-span-2"><Input type="email" {...register('email')} /></Field>
          <Field label="Endereço" error={errors.addressLine?.message} className="sm:col-span-2"><Input placeholder="Rua, número, bairro" {...register('addressLine')} /></Field>
          <Field label="Cidade" error={errors.city?.message}><Input {...register('city')} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="UF" error={errors.state?.message}>
              <Select {...register('state')}><option value="">--</option>{UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</Select>
            </Field>
            <Field label="CEP" error={errors.postalCode?.message}><Input inputMode="numeric" {...register('postalCode')} /></Field>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>Salvar dados</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
