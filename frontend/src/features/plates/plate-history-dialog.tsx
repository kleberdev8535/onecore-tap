import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CopyField } from '@/components/copy-field'
import { usePlateDetail } from '@/features/admin/management-api'
import { formatDateTime } from '@/utils/format'
import { plateEventLabels, plateStatusMeta } from './plate-meta'

export function PlateHistoryDialog({ plateId, onOpenChange }: { plateId: string | null; onOpenChange: (o: boolean) => void }) {
  const detail = usePlateDetail(plateId)
  const plate = detail.data?.plate

  return (
    <Dialog open={plateId !== null} onOpenChange={onOpenChange} title={plate ? `Plaquinha ${plate.serial}` : 'Plaquinha'} description="Link permanente e histórico completo de vínculos.">
      {detail.isPending && (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {plate && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge tone={plateStatusMeta[plate.status].tone} dot>
              {plateStatusMeta[plate.status].label}
            </Badge>
            {plate.restaurant && (
              <span className="text-sm text-fg-secondary">
                {plate.restaurant.name}
                {plate.table && ` · Mesa ${plate.table.name}`}
              </span>
            )}
          </div>
          <p className="mb-1.5 text-[13px] font-medium text-fg-secondary">URL gravada no NFC e no QR Code</p>
          <CopyField value={plate.publicUrl} label="URL da plaquinha" />

          <h3 className="mb-3 mt-6 text-[13px] font-medium text-fg-secondary">Histórico</h3>
          <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
            {detail.data?.history.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-brand" aria-hidden />
                <p className="text-sm font-medium text-fg">{plateEventLabels[e.event]}</p>
                <p className="text-[13px] text-muted">
                  {formatDateTime(e.createdAt)}
                  {e.actorEmail && ` · ${e.actorEmail}`}
                </p>
                {(e.restaurant || e.table) && (
                  <p className="mt-0.5 text-[13px] text-fg-secondary">
                    {e.restaurant?.name}
                    {e.table && ` · Mesa ${e.table.name}`}
                  </p>
                )}
                {e.reason && <p className="mt-1 rounded-md bg-surface-muted px-2.5 py-1.5 text-[13px] text-fg-secondary">{e.reason}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  )
}
