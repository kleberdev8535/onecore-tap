import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CopyField } from '@/components/copy-field'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSaveSettings, useSettings } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import { formatCents, parseCents } from '@/utils/format'

const schema = z.object({
  price: z.string().refine((v) => parseCents(v) !== null, 'Valor inválido. Ex.: 35,00'),
  grace: z.string().refine((v) => /^\d+$/.test(v) && Number(v) <= 60, 'Entre 0 e 60 dias'),
})

export function SettingsPage() {
  const settings = useSettings()
  const save = useSaveSettings()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, control, formState: { errors, isDirty } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: settings.data
      ? { price: (settings.data.platePriceCents / 100).toFixed(2).replace('.', ','), grace: String(settings.data.billingGraceDays) }
      : undefined,
  })
  const price = useWatch({ control, name: 'price' })
  const preview = parseCents(price ?? '')

  const onSubmit = handleSubmit(async ({ price, grace }) => {
    setError(null)
    try {
      await save.mutateAsync({ platePriceCents: parseCents(price)!, billingGraceDays: Number(grace) })
      toast.success('Configurações salvas.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    }
  })

  return (
    <>
      <PageHeader eyebrow="Gestão" title="Configurações" description="Parâmetros globais da plataforma OneCore Tap." />
      <div className="grid max-w-3xl grid-cols-1 gap-6">
        <Card>
          <CardHeader><div><CardTitle>Comercial</CardTitle><CardDescription>Preço padrão da plaquinha (congelado em cada venda) e carência antes da suspensão automática por inadimplência.</CardDescription></div></CardHeader>
          <CardContent>
            {settings.isPending ? <Skeleton className="h-10 w-48" /> : (
              <>
              <FormAlert message={error} />
              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Field label="Valor (R$)" error={errors.price?.message} hint={preview !== null ? `10 mesas = ${formatCents(preview * 10)}` : undefined} className="sm:w-56">
                  <Input inputMode="decimal" {...register('price')} />
                </Field>
                <Field label="Carência (dias)" error={errors.grace?.message} hint="Após o vencimento" className="sm:w-40">
                  <Input inputMode="numeric" {...register('grace')} />
                </Field>
                <Button type="submit" loading={save.isPending} disabled={!isDirty} className="sm:mt-[26px]">Salvar</Button>
              </form>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Endereço público das plaquinhas</CardTitle><CardDescription>Base da URL gravada no NFC e no QR Code. Definida por variável de ambiente (PLATE_PUBLIC_BASE_URL) porque não pode mudar depois que as plaquinhas forem produzidas.</CardDescription></div></CardHeader>
          <CardContent>{settings.data ? <CopyField value={`${settings.data.plateBaseUrl}<TOKEN>`} label="Endereço público" /> : <Skeleton className="h-10 w-full" />}</CardContent>
        </Card>
      </div>
    </>
  )
}
