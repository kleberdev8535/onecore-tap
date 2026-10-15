import { useState } from 'react'
import { Link } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { AddonGroup, Category, Product } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents, parseCents } from '@/utils/format'
import { useSaveProduct } from '../api'
import { groupKindLabel } from './addon-meta'

const schema = z.object({
  categoryId: z.string().min(1, 'Selecione a categoria'),
  name: z.string().trim().min(1, 'Informe o nome').max(120, 'Use até 120 caracteres'),
  description: z.string().trim().max(500, 'Use até 500 caracteres'),
  price: z.string().refine((v) => parseCents(v) !== null, 'Valor inválido. Ex.: 32,90'),
  imageUrl: z.string().trim().refine((v) => v === '' || /^https:\/\/\S+$/.test(v), 'Use um endereço https://'),
  active: z.boolean(),
  available: z.boolean(),
  featured: z.boolean(),
})
type Form = z.infer<typeof schema>

interface ProductDialogProps {
  /** O formulário é montado a cada abertura (use key), então o estado inicial vem daqui. */
  product: Product | 'new'
  categories: Category[]
  groups: AddonGroup[]
  defaultCategoryId?: string
  onClose: () => void
}

export function ProductDialog({ product, categories, groups, defaultCategoryId, onClose }: ProductDialogProps) {
  const editing = product !== 'new' ? product : null
  const save = useSaveProduct()
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(editing?.addonGroupIds ?? [])

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: editing?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? '',
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      price: editing ? (editing.priceCents / 100).toFixed(2).replace('.', ',') : '',
      imageUrl: editing?.imageUrl ?? '',
      active: editing?.active ?? true,
      available: editing?.available ?? true,
      featured: editing?.featured ?? false,
    },
  })

  const [active, available, featured, imageUrl, price] = useWatch({ control, name: ['active', 'available', 'featured', 'imageUrl', 'price'] })
  const [brokenImage, setBrokenImage] = useState<string | null>(null)
  const showImage = /^https:\/\/\S+$/.test(imageUrl) && brokenImage !== imageUrl
  const cents = parseCents(price)

  const toggleGroup = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]))

  const close = () => { setError(null); onClose() }
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: editing?.id,
        categoryId: v.categoryId,
        name: v.name,
        description: v.description || undefined,
        priceCents: parseCents(v.price)!,
        imageUrl: v.imageUrl || undefined,
        active: v.active,
        available: v.available,
        featured: v.featured,
        addonGroupIds: selected,
      })
      toast.success(editing ? 'Produto atualizado.' : 'Produto cadastrado.')
      close()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar o produto.')
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={editing ? `Editar ${editing.name}` : 'Novo produto'}
      description="Nome, preço e foto aparecem no cardápio. Adicionais e variações são escolhidos pelo cliente."
      footer={<><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" form="product-form" loading={save.isPending}>Salvar produto</Button></>}
    >
      <FormAlert message={error} />
      <form id="product-form" onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errors.name?.message} className="sm:col-span-2"><Input placeholder="X-Bacon" {...register('name')} /></Field>
        <Field label="Categoria" error={errors.categoryId?.message}>
          <Select {...register('categoryId')}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (oculta)'}</option>)}
          </Select>
        </Field>
        <Field label="Preço (R$)" hint={cents !== null && price ? formatCents(cents) : 'Ex.: 32,90'} error={errors.price?.message}>
          <Input inputMode="decimal" placeholder="0,00" {...register('price')} />
        </Field>
        <Field label="Descrição" hint="Ingredientes e detalhes que ajudam o cliente a escolher." error={errors.description?.message} className="sm:col-span-2">
          <Textarea rows={3} maxLength={500} {...register('description')} />
        </Field>
        <div className="flex gap-3 sm:col-span-2">
          <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted text-muted" aria-hidden>
            {showImage ? <img src={imageUrl} alt="" className="size-full object-cover" onError={() => setBrokenImage(imageUrl)} /> : <ImageOff className="size-5" />}
          </div>
          <Field label="URL da foto" hint="Endereço https de uma imagem. O upload direto chega com o armazenamento de imagens." error={errors.imageUrl?.message} className="flex-1">
            <Input type="url" placeholder="https://..." {...register('imageUrl')} />
          </Field>
        </div>

        <div className="flex flex-col divide-y divide-line rounded-lg border border-line sm:col-span-2">
          <Toggle label="Ativo no cardápio" hint={active ? 'Visível para os clientes.' : 'Oculto para os clientes.'} checked={active} onChange={(v) => setValue('active', v)} />
          <Toggle label="Disponível" hint={available ? 'Pode ser pedido.' : 'Aparece como esgotado.'} checked={available} onChange={(v) => setValue('available', v)} />
          <Toggle label="Destaque" hint="Aparece em evidência no topo do cardápio." checked={featured} onChange={(v) => setValue('featured', v)} />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-[13px] font-medium text-fg-secondary">Adicionais e variações</legend>
          {groups.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted">
              Nenhum grupo cadastrado. <Link to="/app/cardapio?aba=adicionais" onClick={close} className="font-medium text-brand-700 hover:underline">Criar adicionais e variações</Link>
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-muted">Aparecem no produto na ordem em que forem marcados.</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {groups.map((g) => {
                  const order = selected.indexOf(g.id)
                  const checked = order >= 0
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleGroup(g.id)}
                        className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors', checked ? 'border-brand/40 bg-brand-50' : 'border-line hover:bg-surface-muted')}
                      >
                        <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border text-[11px] font-semibold', checked ? 'border-brand bg-brand text-white' : 'border-line-strong')} aria-hidden>
                          {checked ? order + 1 : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{g.name}</span>
                          <span className="block truncate text-xs text-muted">{groupKindLabel(g)} · {g.options.map((o) => o.name).join(', ')}</span>
                        </span>
                        {checked && <Check className="size-4 text-brand-700" aria-hidden />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </fieldset>
      </form>
    </Dialog>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}
