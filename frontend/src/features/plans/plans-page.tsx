import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, CircleAlert, Layers, Pencil, Plus, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { usePlans, useSavePlan } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { Plan } from '@/types/api'
import { formatCents, parseCents } from '@/utils/format'

export function PlansPage() {
  const plans = usePlans()
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Planos"
        description="Valores, limites e funcionalidades de cada assinatura. Nenhum preço fica fixo no sistema."
        actions={<Button onClick={() => setEditing('new')}><Plus aria-hidden /> Novo plano</Button>}
      />

      {plans.isPending && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      )}
      {plans.isError && (
        <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar os planos" description={plans.error.message} action={<Button variant="secondary" onClick={() => plans.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>
      )}
      {plans.data?.length === 0 && (
        <Card><EmptyState icon={Layers} title="Nenhum plano cadastrado" description="Crie os planos Inicial, Profissional e Avançado com os limites e valores que serão oferecidos aos restaurantes." action={<Button onClick={() => setEditing('new')}><Plus aria-hidden /> Criar plano</Button>} /></Card>
      )}
      {plans.data && plans.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data.map((p) => (
            <Card key={p.id} className={p.active ? 'flex flex-col' : 'flex flex-col opacity-70'}>
              <CardContent className="flex flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-fg">{p.name}</h2>
                    <p className="font-mono text-xs text-muted">{p.code}</p>
                  </div>
                  <Badge tone={p.active ? 'success' : 'neutral'} dot>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <p className="mt-5 text-[28px] font-semibold tracking-tight text-fg tabular">
                  {formatCents(p.monthlyPriceCents)}
                  <span className="ml-1 text-sm font-normal text-muted">/mês</span>
                </p>
                {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
                <dl className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-surface-muted p-3 text-center">
                  <Limit label="Mesas" value={p.maxTables} />
                  <Limit label="Usuários" value={p.maxUsers} />
                  <div><dt className="text-[11px] text-muted">Teste</dt><dd className="text-sm font-semibold text-fg tabular">{p.trialDays ? `${p.trialDays} dias` : 'Não'}</dd></div>
                </dl>
                {p.features.length > 0 && (
                  <ul className="mt-5 flex flex-col gap-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-fg-secondary"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{f}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <span className="text-[13px] text-muted">{p.restaurantCount} {p.restaurantCount === 1 ? 'restaurante' : 'restaurantes'}</span>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(p)}><Pencil aria-hidden /> Editar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && <PlanDialog key={editing === 'new' ? 'new' : editing.id} plan={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function Limit({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-fg tabular">{value ?? 'Ilimitado'}</dd>
    </div>
  )
}

const optionalInt = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+$/.test(v), 'Use um número inteiro')
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || v >= 1, 'Mínimo de 1')

const ALL_MODULES = ['KITCHEN', 'FINANCE', 'REPORTS'] as const
const moduleLabels: Record<string, string> = { KITCHEN: 'Painel da cozinha', FINANCE: 'Financeiro', REPORTS: 'Relatórios' }

const planSchema = z.object({
  code: z.string().trim().refine((v) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), 'Use letras minúsculas, números e hífens'),
  name: z.string().trim().min(2, 'Informe o nome').max(80),
  description: z.string().max(300),
  price: z.string().refine((v) => parseCents(v) !== null, 'Valor inválido. Ex.: 149,90'),
  maxTables: optionalInt,
  maxUsers: optionalInt,
  trialDays: z.coerce.number().int().min(0, 'Mínimo 0').max(90, 'Máximo de 90 dias'),
  features: z.string(),
  modules: z.array(z.string()),
  active: z.boolean(),
})
type PlanForm = z.input<typeof planSchema>
type PlanOut = z.output<typeof planSchema>

/** Montado a cada abertura (key): um novo plano sempre começa vazio. */
function PlanDialog({ plan, onClose }: { plan: Plan | 'new'; onClose: () => void }) {
  const editing = plan !== 'new' ? plan : null
  const save = useSavePlan()
  const [error, setError] = useState<string | null>(null)
  const values: PlanForm = editing
    ? {
        code: editing.code,
        name: editing.name,
        description: editing.description ?? '',
        price: (editing.monthlyPriceCents / 100).toFixed(2).replace('.', ','),
        maxTables: editing.maxTables?.toString() ?? '',
        maxUsers: editing.maxUsers?.toString() ?? '',
        trialDays: editing.trialDays,
        features: editing.features.join('\n'),
        modules: editing.modules ?? [...ALL_MODULES],
        active: editing.active,
      }
    : { code: '', name: '', description: '', price: '', maxTables: '', maxUsers: '', trialDays: 14, features: '', modules: [...ALL_MODULES], active: true }

  const { register, handleSubmit, formState: { errors } } = useForm<PlanForm, unknown, PlanOut>({
    resolver: zodResolver(planSchema),
    defaultValues: values,
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: editing?.id,
        code: v.code,
        name: v.name,
        description: v.description || undefined,
        monthlyPriceCents: parseCents(v.price)!,
        maxTables: v.maxTables,
        maxUsers: v.maxUsers,
        trialDays: v.trialDays,
        features: v.features.split('\n').map((f) => f.trim()).filter(Boolean),
        modules: v.modules,
        active: v.active,
      })
      toast.success(editing ? 'Plano atualizado.' : 'Plano criado.')
      setError(null)
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar o plano.')
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => { if (!o) { setError(null); onClose() } }}
      title={editing ? `Editar ${editing.name}` : 'Novo plano'}
      description={editing ? 'Alterações de valor valem para as próximas cobranças (módulo comercial, Fase 5).' : 'Defina valor mensal, limites e o que o plano inclui.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="plan-form" loading={save.isPending}>Salvar plano</Button></>}
    >
      <FormAlert message={error} />
      <form id="plan-form" onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errors.name?.message}><Input placeholder="Profissional" {...register('name')} /></Field>
        <Field label="Código" hint={editing ? 'Não pode ser alterado' : 'Ex.: profissional'} error={errors.code?.message}>
          <Input readOnly={Boolean(editing)} {...register('code')} />
        </Field>
        <Field label="Valor mensal (R$)" error={errors.price?.message}><Input inputMode="decimal" placeholder="149,90" {...register('price')} /></Field>
        <Field label="Dias de teste" error={errors.trialDays?.message}><Input type="number" min={0} max={90} {...register('trialDays')} /></Field>
        <Field label="Limite de mesas" hint="Vazio = ilimitado" error={errors.maxTables?.message}><Input inputMode="numeric" {...register('maxTables')} /></Field>
        <Field label="Limite de usuários" hint="Vazio = ilimitado" error={errors.maxUsers?.message}><Input inputMode="numeric" {...register('maxUsers')} /></Field>
        <Field label="Descrição" hint="Opcional" error={errors.description?.message} className="sm:col-span-2"><Input {...register('description')} /></Field>
        <Field label="Funcionalidades" hint="Uma por linha" error={errors.features?.message} className="sm:col-span-2">
          <Textarea rows={4} placeholder={'Cardápio digital\nPedidos em tempo real\nPainel da cozinha'} {...register('features')} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-medium text-fg-secondary">Módulos incluídos</legend>
          <p className="mb-3 text-xs text-muted">Cardápio, mesas, pedidos e registro de pagamentos estão em todos os planos. Desmarcar bloqueia o módulo no painel e na API.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ALL_MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-sm text-fg">
                <input type="checkbox" value={m} className="size-4 accent-[var(--color-brand)]" {...register('modules')} />
                {moduleLabels[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-3 text-sm text-fg-secondary sm:col-span-2">
          <input type="checkbox" className="size-4 accent-[var(--color-brand)]" {...register('active')} />
          Plano ativo (disponível para novos restaurantes)
        </label>
      </form>
    </Dialog>
  )
}
