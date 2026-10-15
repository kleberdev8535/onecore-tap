import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { useRestaurants } from '@/features/admin/api'
import { useChangePlate, useRestaurantTables } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { PlateView } from '@/types/api'

interface BindPlateDialogProps {
  plate: PlateView | null
  /** Restaurante fixo (quando aberto a partir da pagina do restaurante). */
  restaurantId?: string
  onOpenChange: (open: boolean) => void
}

/** Vincula ou transfere a plaquinha. A URL gravada no NFC/QR nao muda: so o vinculo. */
export function BindPlateDialog({ plate, restaurantId: fixedRestaurant, onOpenChange }: BindPlateDialogProps) {
  const open = plate !== null
  const [restaurantId, setRestaurantId] = useState('')
  const [tableId, setTableId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const selectedRestaurant = fixedRestaurant ?? restaurantId
  const restaurants = useRestaurants({ search: '', status: '', page: 0, size: 100 })
  const tables = useRestaurantTables(selectedRestaurant)
  const change = useChangePlate()

  const close = (next: boolean) => {
    if (!next) {
      setRestaurantId('')
      setTableId('')
      setError(null)
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (!plate || !selectedRestaurant) {
      setError('Selecione o restaurante.')
      return
    }
    try {
      await change.mutateAsync({
        id: plate.id,
        action: 'BIND',
        restaurantId: selectedRestaurant,
        tableId: tableId || undefined,
      })
      toast.success(tableId ? `${plate.serial} vinculada à mesa` : `${plate.serial} reservada para o restaurante`)
      close(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível vincular.')
    }
  }

  const transferring = plate?.status === 'ACTIVE'
  const liveRestaurants = restaurants.data?.items.filter((r) => r.status !== 'CANCELLED') ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={transferring ? `Transferir ${plate?.serial}` : `Vincular ${plate?.serial ?? ''}`}
      description="O link do QR Code e do chip NFC continua o mesmo. Nada precisa ser reimpresso ou regravado."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={change.isPending}>
            {tableId ? 'Vincular à mesa' : 'Reservar para o restaurante'}
          </Button>
        </>
      }
    >
      <FormAlert message={error} />
      <div className="flex flex-col gap-4">
        {!fixedRestaurant && (
          <Field label="Restaurante">
            <Select
              value={restaurantId}
              onChange={(e) => {
                setRestaurantId(e.target.value)
                setTableId('')
              }}
            >
              <option value="">Selecione</option>
              {liveRestaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.tradeName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label="Mesa"
          hint={
            selectedRestaurant && tables.data?.length === 0
              ? 'Este restaurante ainda não tem mesas. Sem mesa, a plaquinha fica reservada.'
              : 'Sem mesa, a plaquinha fica apenas reservada para o restaurante.'
          }
        >
          <Select value={tableId} onChange={(e) => setTableId(e.target.value)} disabled={!selectedRestaurant || tables.isPending}>
            <option value="">Sem mesa (reservar)</option>
            {tables.data
              ?.filter((t) => t.active)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  Mesa {t.label}
                </option>
              ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  )
}
