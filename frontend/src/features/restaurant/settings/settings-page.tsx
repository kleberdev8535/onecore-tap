import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleAlert, RotateCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { restaurantStatusMeta } from '@/features/admin/restaurant-status-meta'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { RestaurantSettings } from '@/types/api'
import { useRestaurantSettings, useUpdateContact, useUpdateOperation } from '../api'
import { contactFrom } from './contact-input'
import { SubscriptionCard } from './subscription-card'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const digits = (v: string) => v.replace(/\D/g, '')
const optDigits = (len: number[], msg: string) => z.string().transform(digits).refine((v) => v === '' || len.includes(v.length), msg)
const formatCnpj = (v: string) => v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

export function RestaurantSettingsPage() {
  const settings = useRestaurantSettings()
  return (
    <>
      <PageHeader eyebrow="Estabelecimento" title="Configurações" description="Contato, endereço e regras de operação do restaurante." />
      {settings.isPending && <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>}
      {settings.isError && <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar as configurações" description={settings.error.message} action={<Button variant="secondary" onClick={() => settings.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>}
      {settings.data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <ContactCard settings={settings.data} />
            <OperationCard settings={settings.data} />
          </div>
          <div className="flex flex-col gap-6">
            <CommercialCard settings={settings.data} />
            <SubscriptionCard />
          </div>
        </div>
      )}
    </>
  )
}

const contactSchema = z.object({
  email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido'),
  phone: optDigits([10, 11], 'Informe DDD + número'),
  addressLine: z.string().max(200, 'Use até 200 caracteres'),
  city: z.string().max(100, 'Use até 100 caracteres'),
  state: z.string(),
  postalCode: optDigits([8], 'CEP deve ter 8 dígitos'),
})
type ContactIn = z.input<typeof contactSchema>
type ContactOut = z.output<typeof contactSchema>

function ContactCard({ settings: s }: { settings: RestaurantSettings }) {
  const save = useUpdateContact()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ContactIn, unknown, ContactOut>({
    resolver: zodResolver(contactSchema),
    values: { email: s.email ?? '', phone: s.phone ?? '', addressLine: s.addressLine ?? '', city: s.city ?? '', state: s.state ?? '', postalCode: s.postalCode ?? '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await save.mutateAsync(contactFrom(s, { ...v, addressLine: v.addressLine.trim(), city: v.city.trim() }))
      toast.success('Contato e endereço salvos.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    }
  })

  return (
    <Card>
      <CardHeader><div><CardTitle>Contato e endereço</CardTitle><CardDescription>Exibidos no cardápio e usados pela OneCore Business para falar com o restaurante.</CardDescription></div></CardHeader>
      <CardContent>
        <FormAlert message={error} />
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field label="E-mail" error={errors.email?.message} className="sm:col-span-3"><Input type="email" {...register('email')} /></Field>
          <Field label="Telefone" hint="Com DDD" error={errors.phone?.message} className="sm:col-span-3"><Input inputMode="tel" {...register('phone')} /></Field>
          <Field label="Endereço" error={errors.addressLine?.message} className="sm:col-span-6"><Input placeholder="Rua, número, bairro" {...register('addressLine')} /></Field>
          <Field label="Cidade" error={errors.city?.message} className="sm:col-span-3"><Input {...register('city')} /></Field>
          <Field label="UF" className="sm:col-span-1">
            <Select {...register('state')}>
              <option value="">--</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
          </Field>
          <Field label="CEP" error={errors.postalCode?.message} className="sm:col-span-2"><Input inputMode="numeric" {...register('postalCode')} /></Field>
          <div className="flex justify-end sm:col-span-6">
            <Button type="submit" loading={save.isPending} disabled={!isDirty}>Salvar contato</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function OperationCard({ settings: s }: { settings: RestaurantSettings }) {
  const save = useUpdateOperation()
  const toggle = async (value: boolean) => {
    try {
      await save.mutateAsync(value)
      toast.success(value ? 'Pedidos passam a aguardar confirmação.' : 'Pedidos vão direto para a cozinha.')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <Card>
      <CardHeader><div><CardTitle>Operação de pedidos</CardTitle><CardDescription>Regras aplicadas aos pedidos feitos pela plaquinha.</CardDescription></div></CardHeader>
      <CardContent>
        <label className="flex items-start justify-between gap-4 rounded-lg border border-line px-4 py-3.5">
          <span className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} aria-hidden />
            <span>
              <span className="block text-sm font-medium text-fg">Confirmar pedidos antes da cozinha</span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                Um QR Code pode ser fotografado e usado fora do restaurante. Com esta opção, cada pedido feito pela plaquinha aguarda a confirmação da equipe antes de entrar em preparo. Recomendado.
              </span>
            </span>
          </span>
          <Switch checked={s.requireOrderConfirmation} disabled={save.isPending} onCheckedChange={toggle} aria-label="Confirmar pedidos antes da cozinha" />
        </label>
      </CardContent>
    </Card>
  )
}

function CommercialCard({ settings: s }: { settings: RestaurantSettings }) {
  const status = restaurantStatusMeta[s.status]
  return (
    <Card>
      <CardHeader><div><CardTitle>Dados comerciais</CardTitle><CardDescription>Alterados somente pela OneCore Business.</CardDescription></div></CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Nome comercial" value={s.tradeName} />
          <Row label="Razão social" value={s.legalName} />
          <Row label="CNPJ" value={s.cnpj ? formatCnpj(s.cnpj) : null} />
          <div className="flex items-center justify-between gap-3"><dt className="text-muted">Situação</dt><dd><Badge tone={status.tone} dot>{status.label}</Badge></dd></div>
        </dl>
        <div className="mt-5 rounded-lg bg-surface-muted p-4">
          <p className="text-[13px] font-medium text-fg-secondary">Plano</p>
          {s.plan ? (
            <>
              <p className="mt-0.5 text-base font-semibold text-fg">{s.plan.name}</p>
              <p className="mt-1 text-[13px] text-muted">
                {s.plan.maxTables ? `Até ${s.plan.maxTables} mesas` : 'Mesas ilimitadas'} · {s.plan.maxUsers ? `até ${s.plan.maxUsers} usuários` : 'usuários ilimitados'}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-muted">Ainda não definido pela OneCore Business.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate text-right font-medium text-fg">{value ?? <span className="font-normal text-muted">Não informado</span>}</dd>
    </div>
  )
}
