import { useState } from 'react'
import { CircleAlert, Layers, MoreHorizontal, Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { AddonGroup } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'
import { useAddonGroups, useDeleteAddonGroup } from '../api'
import { AddonGroupDialog } from './addon-group-dialog'
import { choiceRule, groupKindLabel, isVariation } from './addon-meta'

export function AddonsPanel({ manage }: { manage: boolean }) {
  const groups = useAddonGroups()
  const [editing, setEditing] = useState<AddonGroup | 'new' | null>(null)

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted">
          <strong className="font-medium text-fg-secondary">Variações</strong> são escolhas obrigatórias, como o tamanho.{' '}
          <strong className="font-medium text-fg-secondary">Adicionais</strong> são opcionais, como bacon ou queijo extra. Um grupo pode ser usado em vários produtos.
        </p>
        {manage && <Button className="shrink-0" onClick={() => setEditing('new')}><Plus aria-hidden /> Novo grupo</Button>}
      </div>

      {groups.isPending && <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy>{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>}
      {groups.isError && <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar os adicionais" description={groups.error.message} action={<Button variant="secondary" onClick={() => groups.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>}
      {groups.data?.length === 0 && (
        <Card>
          <EmptyState icon={Layers} title="Nenhum grupo de adicionais" description="Crie grupos como Tamanho (variação) ou Adicionais e vincule-os aos produtos." action={manage && <Button onClick={() => setEditing('new')}><Plus aria-hidden /> Criar grupo</Button>} />
        </Card>
      )}
      {groups.data && groups.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.data.map((g) => <GroupCard key={g.id} group={g} manage={manage} onEdit={() => setEditing(g)} />)}
        </div>
      )}

      {editing && <AddonGroupDialog key={editing === 'new' ? 'new' : editing.id} group={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function GroupCard({ group: g, manage, onEdit }: { group: AddonGroup; manage: boolean; onEdit: () => void }) {
  const remove = useDeleteAddonGroup()
  const [deleting, setDeleting] = useState(false)

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-fg">{g.name}</h3>
              <Badge tone={isVariation(g) ? 'info' : 'neutral'}>{groupKindLabel(g)}</Badge>
            </div>
            <p className="mt-0.5 text-[13px] text-muted">{choiceRule(g)} · usado em {g.productCount} {g.productCount === 1 ? 'produto' : 'produtos'}</p>
          </div>
          {manage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações de ${g.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Editar</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDeleting(true)} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger"><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <ul className="mt-4 flex flex-col divide-y divide-line rounded-lg border border-line">
          {g.options.map((o) => (
            <li key={o.id} className={cn('flex items-center justify-between gap-3 px-3 py-2 text-sm', !o.available && 'text-muted')}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{o.name}</span>
                {!o.available && <Badge tone="danger" dot>Esgotado</Badge>}
              </span>
              <span className="shrink-0 tabular text-fg-secondary">{o.priceCents ? `+ ${formatCents(o.priceCents)}` : 'Sem custo'}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      {deleting && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setDeleting(false)}
          title={`Excluir ${g.name}`}
          description={g.productCount > 0 ? `O grupo será removido de ${g.productCount} ${g.productCount === 1 ? 'produto' : 'produtos'}. Esta ação não pode ser desfeita.` : 'Esta ação não pode ser desfeita.'}
          confirmLabel="Excluir grupo"
          tone="danger"
          requireReason={false}
          hideNote
          onConfirm={async () => {
            await remove.mutateAsync(g.id)
            toast.success('Grupo excluído.')
          }}
        />
      )}
    </Card>
  )
}
