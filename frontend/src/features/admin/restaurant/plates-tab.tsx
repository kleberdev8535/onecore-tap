import { useState } from 'react'
import { Link } from 'react-router'
import { Link2, Nfc } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlates } from '@/features/admin/management-api'
import { BindPlateDialog } from '@/features/plates/bind-plate-dialog'
import { PlateActions } from '@/features/plates/plate-actions'
import { plateStatusMeta } from '@/features/plates/plate-meta'
import type { PlateView } from '@/types/api'

export function PlatesTab({ restaurantId }: { restaurantId: string }) {
  const bound = usePlates({ search: '', status: '', restaurantId, page: 0 })
  const available = usePlates({ search: '', status: 'AVAILABLE', page: 0 })
  const [binding, setBinding] = useState<PlateView | null>(null)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden">
        <CardHeader><div><CardTitle>Plaquinhas deste restaurante</CardTitle><CardDescription>Ativas, reservadas e suspensas.</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          {bound.isPending && <div className="p-5"><Skeleton className="h-12 w-full" /></div>}
          {bound.data?.items.length === 0 && <EmptyState className="py-8" icon={Nfc} title="Nenhuma plaquinha vinculada" description="Escolha plaquinhas disponíveis no estoque e vincule cada uma a uma mesa." />}
          {bound.data && bound.data.items.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {bound.data.items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="font-mono text-sm font-medium text-fg">{p.serial}</span>
                  <Badge tone={plateStatusMeta[p.status].tone} dot>{plateStatusMeta[p.status].label}</Badge>
                  <span className="flex-1 truncate text-[13px] text-muted">{p.table ? `Mesa ${p.table.name}` : 'sem mesa'}</span>
                  <PlateActions plate={p} restaurantId={restaurantId} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader><div><CardTitle>Disponíveis no estoque</CardTitle><CardDescription>{available.data?.totalItems ?? 0} plaquinhas prontas para vincular.</CardDescription></div></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {available.data?.items.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <span className="font-mono text-sm text-fg">{p.serial}</span>
              <Button size="sm" variant="secondary" onClick={() => setBinding(p)}><Link2 aria-hidden /> Vincular</Button>
            </div>
          ))}
          {available.data?.totalItems === 0 && (
            <p className="text-[13px] text-muted">Sem estoque. <Link to="/admin/estoque?novo=1" className="font-medium text-brand-700 hover:underline">Cadastre um lote</Link>.</p>
          )}
        </CardContent>
      </Card>

      <BindPlateDialog plate={binding} restaurantId={restaurantId} onOpenChange={(o) => !o && setBinding(null)} />
    </div>
  )
}
