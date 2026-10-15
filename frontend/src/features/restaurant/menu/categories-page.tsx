import { useState } from 'react'
import { Link } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDown, ArrowUp, CircleAlert, MoreHorizontal, Pencil, Plus, RotateCw, Tags, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { FormAlert } from '@/features/auth/form-alert'
import { useSession } from '@/features/auth/api'
import { ApiError } from '@/services/http'
import type { Category } from '@/types/api'
import { cn } from '@/utils/cn'
import { useCategories, useDeleteCategory, useReorderCategories, useSaveCategory } from '../api'
import { can } from '../navigation'

export function CategoriesPage() {
  const { data: me } = useSession()
  const manage = Boolean(me && can(me, 'MENU_MANAGE'))
  const categories = useCategories()
  const reorder = useReorderCategories()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const remove = useDeleteCategory()
  const list = categories.data ?? []

  const move = async (index: number, delta: -1 | 1) => {
    const ids = list.map((c) => c.id)
    const target = index + delta
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    try {
      await reorder.mutateAsync(ids)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível reordenar.')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cardápio"
        title="Categorias"
        description="As seções do cardápio, na ordem em que o cliente vê. Categorias inativas ficam ocultas no cardápio."
        actions={manage && <Button onClick={() => setEditing('new')}><Plus aria-hidden /> Nova categoria</Button>}
      />

      <Card className="overflow-hidden">
        {categories.isPending && (
          <div className="divide-y divide-line" aria-busy>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-4 px-5 py-4"><Skeleton className="h-4 w-6" /><Skeleton className="h-4 w-48" /></div>)}
          </div>
        )}
        {categories.isError && (
          <EmptyState icon={CircleAlert} title="Não foi possível carregar as categorias" description={categories.error.message} action={<Button variant="secondary" onClick={() => categories.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />
        )}
        {categories.data?.length === 0 && (
          <EmptyState
            icon={Tags}
            title="Nenhuma categoria"
            description="Crie seções como Lanches, Bebidas e Sobremesas para organizar os produtos."
            action={manage && <Button onClick={() => setEditing('new')}><Plus aria-hidden /> Criar categoria</Button>}
          />
        )}
        {list.length > 0 && (
          <ol className={cn('divide-y divide-line', reorder.isPending && 'opacity-60')}>
            {list.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="w-6 text-center text-[13px] font-medium text-muted tabular" aria-hidden>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{c.name}</span>
                    {!c.active && <Badge tone="neutral" dot>Oculta</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-muted">
                    <Link to={`/app/cardapio?categoria=${c.id}`} className="hover:underline">{c.productCount} {c.productCount === 1 ? 'produto' : 'produtos'}</Link>
                    {c.description && <> · {c.description}</>}
                  </p>
                </div>
                {manage && (
                  <>
                    <div className="hidden gap-1 sm:flex">
                      <Button variant="ghost" size="icon-sm" aria-label={`Mover ${c.name} para cima`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Mover ${c.name} para baixo`} disabled={i === list.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações de ${c.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(c)}><Pencil aria-hidden /> Editar</DropdownMenuItem>
                        <DropdownMenuItem className="sm:hidden" disabled={i === 0} onSelect={() => move(i, -1)}><ArrowUp aria-hidden /> Mover para cima</DropdownMenuItem>
                        <DropdownMenuItem className="sm:hidden" disabled={i === list.length - 1} onSelect={() => move(i, 1)}><ArrowDown aria-hidden /> Mover para baixo</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setDeleting(c)} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger"><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {editing && <CategoryDialog key={editing === 'new' ? 'new' : editing.id} category={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Excluir ${deleting.name}`}
          description={deleting.productCount > 0 ? 'Esta categoria tem produtos. Mova-os para outra categoria ou exclua-os antes.' : 'A categoria será removida do cardápio. Esta ação não pode ser desfeita.'}
          confirmLabel="Excluir categoria"
          tone="danger"
          requireReason={false}
          hideNote
          onConfirm={async () => {
            await remove.mutateAsync(deleting.id)
            toast.success('Categoria excluída.')
          }}
        />
      )}
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(80, 'Use até 80 caracteres'),
  description: z.string().trim().max(200, 'Use até 200 caracteres'),
  active: z.boolean(),
})
type Form = z.infer<typeof schema>

function CategoryDialog({ category, onClose }: { category: Category | 'new'; onClose: () => void }) {
  const editing = category !== 'new' ? category : null
  const save = useSaveCategory()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: editing?.name ?? '', description: editing?.description ?? '', active: editing?.active ?? true },
  })
  const active = useWatch({ control, name: 'active' })

  const close = () => { setError(null); onClose() }
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await save.mutateAsync({ id: editing?.id, name: v.name, description: v.description || undefined, active: v.active })
      toast.success(editing ? 'Categoria atualizada.' : 'Categoria criada.')
      close()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar a categoria.')
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={editing ? `Editar ${editing.name}` : 'Nova categoria'}
      footer={<><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" form="category-form" loading={save.isPending}>Salvar</Button></>}
    >
      <FormAlert message={error} />
      <form id="category-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Nome" error={errors.name?.message}><Input placeholder="Lanches" autoFocus {...register('name')} /></Field>
        <Field label="Descrição" hint="Opcional. Aparece abaixo do título da seção." error={errors.description?.message}><Input placeholder="Feitos na hora com pão artesanal" {...register('description')} /></Field>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-fg">Visível no cardápio</span>
            <span className="block text-xs text-muted">{active ? 'Os clientes veem esta categoria.' : 'Oculta para os clientes; os produtos continuam cadastrados.'}</span>
          </span>
          <Switch checked={active} onCheckedChange={(v) => setValue('active', v)} aria-label="Visível no cardápio" />
        </label>
      </form>
    </Dialog>
  )
}
