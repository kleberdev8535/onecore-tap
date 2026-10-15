import { useState } from 'react'
import {
  Archive,
  Ban,
  Download,
  FileImage,
  History,
  Link2,
  Link2Off,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { ReasonDialog } from '@/components/reason-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChangePlate } from '@/features/admin/management-api'
import { ApiError } from '@/services/http'
import type { PlateAction, PlateView } from '@/types/api'
import { downloadFile } from '@/utils/download'
import { BindPlateDialog } from './bind-plate-dialog'
import { PlateHistoryDialog } from './plate-history-dialog'

type ReasonAction = Extract<PlateAction, 'RELEASE' | 'SUSPEND' | 'DAMAGE' | 'DEACTIVATE' | 'REACTIVATE' | 'RESTORE'>

const reasonCopy: Record<ReasonAction, { title: string; description: string; confirm: string; danger?: boolean; requireReason: boolean }> = {
  RELEASE: { title: 'Desvincular plaquinha', description: 'Ela volta ao estoque como disponível e deixa de abrir o cardápio.', confirm: 'Desvincular', requireReason: true },
  SUSPEND: { title: 'Suspender plaquinha', description: 'O vínculo é mantido, mas o cardápio deixa de abrir por ela até ser reativada.', confirm: 'Suspender', requireReason: true },
  REACTIVATE: { title: 'Reativar plaquinha', description: 'O cardápio volta a abrir pela plaquinha na mesma mesa.', confirm: 'Reativar', requireReason: false },
  DAMAGE: { title: 'Marcar como danificada', description: 'A plaquinha sai de uso e é desvinculada até passar por inspeção.', confirm: 'Marcar como danificada', danger: true, requireReason: true },
  RESTORE: { title: 'Devolver ao estoque', description: 'Use após confirmar que a plaquinha funciona (NFC e QR Code).', confirm: 'Devolver ao estoque', requireReason: false },
  DEACTIVATE: { title: 'Desativar definitivamente', description: 'Baixa permanente: a plaquinha não poderá voltar a ser usada.', confirm: 'Desativar', danger: true, requireReason: true },
}

/** Menu de acoes por plaquinha. Mostra apenas as transicoes validas para o status atual. */
export function PlateActions({ plate, restaurantId }: { plate: PlateView; restaurantId?: string }) {
  const change = useChangePlate()
  const [bindOpen, setBindOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null)
  const s = plate.status

  const download = async (format: 'svg' | 'png') => {
    try {
      await downloadFile(`/admin/plates/${plate.id}/qr.${format}`, `${plate.serial}.${format}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível baixar o QR Code.')
    }
  }

  const copy = reasonAction ? reasonCopy[reasonAction] : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações da plaquinha ${plate.serial}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(s === 'AVAILABLE' || s === 'RESERVED' || s === 'ACTIVE') && (
            <DropdownMenuItem onSelect={() => setBindOpen(true)}>
              <Link2 aria-hidden /> {s === 'ACTIVE' ? 'Transferir' : 'Vincular a mesa'}
            </DropdownMenuItem>
          )}
          {s === 'ACTIVE' && (
            <DropdownMenuItem onSelect={() => setReasonAction('SUSPEND')}>
              <PauseCircle aria-hidden /> Suspender
            </DropdownMenuItem>
          )}
          {s === 'SUSPENDED' && (
            <DropdownMenuItem onSelect={() => setReasonAction('REACTIVATE')}>
              <PlayCircle aria-hidden /> Reativar
            </DropdownMenuItem>
          )}
          {(s === 'RESERVED' || s === 'ACTIVE' || s === 'SUSPENDED') && (
            <DropdownMenuItem onSelect={() => setReasonAction('RELEASE')}>
              <Link2Off aria-hidden /> Desvincular
            </DropdownMenuItem>
          )}
          {s === 'DAMAGED' && (
            <DropdownMenuItem onSelect={() => setReasonAction('RESTORE')}>
              <RotateCcw aria-hidden /> Devolver ao estoque
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
            <History aria-hidden /> Link e histórico
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download('svg')}>
            <Download aria-hidden /> QR Code (SVG)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download('png')}>
            <FileImage aria-hidden /> QR Code (PNG)
          </DropdownMenuItem>
          {s !== 'DEACTIVATED' && <DropdownMenuSeparator />}
          {s !== 'DAMAGED' && s !== 'DEACTIVATED' && (
            <DropdownMenuItem onSelect={() => setReasonAction('DAMAGE')}>
              <TriangleAlert aria-hidden /> Marcar como danificada
            </DropdownMenuItem>
          )}
          {s !== 'DEACTIVATED' && (
            <DropdownMenuItem onSelect={() => setReasonAction('DEACTIVATE')} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger">
              {s === 'DAMAGED' ? <Archive aria-hidden /> : <Ban aria-hidden />} Desativar definitivamente
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BindPlateDialog plate={bindOpen ? plate : null} restaurantId={restaurantId} onOpenChange={setBindOpen} />
      <PlateHistoryDialog plateId={historyOpen ? plate.id : null} onOpenChange={setHistoryOpen} />
      {copy && reasonAction && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setReasonAction(null)}
          title={`${copy.title} ${plate.serial}`}
          description={copy.description}
          confirmLabel={copy.confirm}
          tone={copy.danger ? 'danger' : 'primary'}
          requireReason={copy.requireReason}
          onConfirm={async (reason) => {
            await change.mutateAsync({ id: plate.id, action: reasonAction, reason: reason || undefined })
            toast.success(`Plaquinha ${plate.serial} atualizada.`)
          }}
        />
      )}
    </>
  )
}
