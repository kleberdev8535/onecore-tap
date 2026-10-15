import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { AddonGroup } from '@/types/api'
import { cn } from '@/utils/cn'
import { parseCents } from '@/utils/format'
import { useSaveAddonGroup } from '../api'
import { choiceRule, isVariation } from './addon-meta'

type Kind = 'variation' | 'addons'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome').max(80, 'Use até 80 caracteres'),
    kind: z.enum(['variation', 'addons']),
    minChoices: z.coerce.number().int('Use um número inteiro').min(0, 'Mínimo 0').max(20, 'Máximo 20'),
    maxChoices: z.coerce.number().int('Use um número inteiro').min(1, 'Mínimo 1').max(20, 'Máximo 20'),
    options: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1, 'Informe a opção').max(80, 'Use até 80 caracteres'),
          price: z.string().refine((v) => v.trim() === '' || parseCents(v) !== null, 'Valor inválido'),
          available: z.boolean(),
        }),
      )
      .min(1, 'Cadastre ao menos uma opção')
      .max(50, 'Use até 50 opções'),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'addons' && v.minChoices > v.maxChoices) ctx.addIssue({ code: 'custom', path: ['minChoices'], message: 'Maior que o máximo' })
    if (v.kind === 'addons' && v.maxChoices > v.options.length) ctx.addIssue({ code: 'custom', path: ['maxChoices'], message: `Há ${v.options.length} opções` })
    const names = v.options.map((o) => o.name.trim().toLowerCase())
    names.forEach((n, i) => {
      if (n && names.indexOf(n) !== i) ctx.addIssue({ code: 'custom', path: ['options', i, 'name'], message: 'Opção repetida' })
    })
  })
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const emptyOption = { name: '', price: '', available: true }

/** Montado a cada abertura (use key): o formulário sempre começa do grupo editado ou vazio. */
export function AddonGroupDialog({ group, onClose }: { group: AddonGroup | 'new'; onClose: () => void }) {
  const editing = group !== 'new' ? group : null
  const save = useSaveAddonGroup()
  const [error, setError] = useState<string | null>(null)

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          name: editing.name,
          kind: isVariation(editing) ? 'variation' : 'addons',
          minChoices: editing.minChoices,
          maxChoices: editing.maxChoices,
          options: editing.options.map((o) => ({ id: o.id, name: o.name, price: o.priceCents ? (o.priceCents / 100).toFixed(2).replace('.', ',') : '', available: o.available })),
        }
      : { name: '', kind: 'addons', minChoices: 0, maxChoices: 1, options: [{ ...emptyOption }, { ...emptyOption }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'options' })
  const [kindValue, minValue, maxValue, options] = useWatch({ control, name: ['kind', 'minChoices', 'maxChoices', 'options'] })
  const kind = kindValue as Kind
  const minChoices = Number(minValue) || 0
  const maxChoices = Number(maxValue) || 1

  const close = () => { setError(null); onClose() }
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const variation = v.kind === 'variation'
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: v.name,
        minChoices: variation ? 1 : v.minChoices,
        maxChoices: variation ? 1 : v.maxChoices,
        options: v.options.map((o) => ({ id: o.id, name: o.name, priceCents: o.price.trim() ? parseCents(o.price)! : 0, available: o.available })),
      })
      toast.success(editing ? 'Grupo atualizado.' : 'Grupo criado.')
      close()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar o grupo.')
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={editing ? `Editar ${editing.name}` : 'Novo grupo'}
      description="Os preços das opções somam ao preço do produto."
      footer={<><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" form="addon-form" loading={save.isPending}>Salvar grupo</Button></>}
    >
      <FormAlert message={error} />
      <form id="addon-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nome do grupo" error={errors.name?.message}><Input placeholder={kind === 'variation' ? 'Tamanho' : 'Adicionais'} {...register('name')} /></Field>

        <div role="radiogroup" aria-label="Tipo de grupo" className="grid grid-cols-2 rounded-lg bg-surface-muted p-1">
          {(['variation', 'addons'] as Kind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setValue('kind', k)} className={cn('h-9 rounded-md text-[13px] font-medium transition-colors', kind === k ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg')}>
              {k === 'variation' ? 'Variação' : 'Adicionais'}
            </button>
          ))}
        </div>

        {kind === 'addons' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mínimo de escolhas" hint="0 = opcional" error={errors.minChoices?.message}><Input type="number" min={0} max={20} {...register('minChoices')} /></Field>
            <Field label="Máximo de escolhas" error={errors.maxChoices?.message}><Input type="number" min={1} max={20} {...register('maxChoices')} /></Field>
          </div>
        ) : null}
        <p className="-mt-1 text-xs text-muted">Regra para o cliente: {kind === 'variation' ? choiceRule({ minChoices: 1, maxChoices: 1 }) : choiceRule({ minChoices, maxChoices: Math.max(maxChoices, 1) })}.</p>

        <fieldset>
          <legend className="text-[13px] font-medium text-fg-secondary">Opções</legend>
          <ul className="mt-2 flex flex-col gap-2">
            {fields.map((field, i) => {
              const available = options?.[i]?.available ?? true
              return (
                <li key={field.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input aria-label={`Nome da opção ${i + 1}`} placeholder={kind === 'variation' ? 'Médio' : 'Bacon'} invalid={Boolean(errors.options?.[i]?.name)} {...register(`options.${i}.name`)} />
                    {errors.options?.[i]?.name && <p className="mt-1 text-xs font-medium text-danger">{errors.options[i]?.name?.message}</p>}
                  </div>
                  <div className="w-28 shrink-0">
                    <Input aria-label={`Preço adicional da opção ${i + 1}`} inputMode="decimal" placeholder="+ 0,00" invalid={Boolean(errors.options?.[i]?.price)} {...register(`options.${i}.price`)} />
                    {errors.options?.[i]?.price && <p className="mt-1 text-xs font-medium text-danger">{errors.options[i]?.price?.message}</p>}
                  </div>
                  <div className="flex h-10 items-center">
                    <Switch checked={available} onCheckedChange={(v) => setValue(`options.${i}.available`, v)} aria-label={`Opção ${i + 1} disponível`} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover opção ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><X /></Button>
                </li>
              )
            })}
          </ul>
          {errors.options?.root?.message && <p className="mt-1 text-xs font-medium text-danger">{errors.options.root.message}</p>}
          <p className="mt-2 text-xs text-muted">O interruptor indica se a opção está disponível. Deixe o preço vazio para opções sem custo.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={fields.length >= 50} onClick={() => append({ ...emptyOption })}><Plus aria-hidden /> Adicionar opção</Button>
        </fieldset>
      </form>
    </Dialog>
  )
}
