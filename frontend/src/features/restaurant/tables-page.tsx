import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleAlert, Clock, DoorOpen, ExternalLink, Receipt, LayoutGrid, Nfc, Plus, RotateCw, Users } from 'lucide-react'
import { toast } from 'sonner'
import { CopyField } from '@/components/copy-field'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { FormAlert } from '@/features/auth/form-alert'
import { useSession } from '@/features/auth/api'
import { ApiError } from '@/services/http'
import type { BadgeProps } from '@/components/ui/badge'
import { useCloseTable } from '@/features/orders/api'
import { useNow } from '@/features/orders/order-format'
import type { RestaurantTable, TableState } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'
import { RegisterPaymentDialog } from '@/features/finance/register-payment-dialog'
import { usePendingPayments } from '@/features/finance/api'
import { useCreateTables, useTables, useUpdateTable } from './api'
import { can } from './navigation'

export function TablesPage() {
  const { data: me } = useSession()
  const manage = Boolean(me && can(me, 'TABLES_MANAGE'))
  const serve = Boolean(me && can(me, 'ORDERS_MANAGE'))
  // Caixa abre a mesa para ver o link e receber o pagamento (sem editar nem encerrar o atendimento).
  const receive = Boolean(me && can(me, 'PAYMENTS_REGISTER'))
  const tables = useTables()
  const [editing, setEditing] = useState<RestaurantTable | null>(null)
  const list = tables.data ?? []
  const active = list.filter((t) => t.active).length
  const withPlate = list.filter((t) => t.plate).length
  const occupied = list.filter((t) => t.state !== 'FREE' && t.state !== 'UNAVAILABLE').length

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Mesas"
        description="A situação de cada mesa vem do atendimento real: ocupada a partir do primeiro pedido e livre quando a equipe encerra o atendimento. Abrir o QR Code não ocupa a mesa."
      />
      <div className={cn('grid grid-cols-1 gap-6', manage && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Mesas cadastradas</CardTitle>
              <CardDescription>{occupied} em atendimento · {active} ativas de {list.length} · {withPlate} com plaquinha</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {tables.isPending && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>}
            {tables.isError && <EmptyState className="py-8" icon={CircleAlert} title="Não foi possível carregar as mesas" description={tables.error.message} action={<Button variant="secondary" onClick={() => tables.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />}
            {tables.data?.length === 0 && <EmptyState className="py-8" icon={LayoutGrid} title="Nenhuma mesa cadastrada" description={manage ? 'Cadastre as mesas ao lado. Depois, a OneCore Business vincula uma plaquinha a cada uma.' : 'O responsável pelo restaurante ainda não cadastrou as mesas.'} />}
            {list.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {list.map((t) => (
                  <li key={t.id}>
                    <TableTile table={t} onEdit={manage || serve || receive ? () => setEditing(t) : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {manage && <CreateTablesCard />}
      </div>
      {editing && <EditTableDialog key={editing.id} table={list.find((t) => t.id === editing.id) ?? editing} canEdit={manage} canServe={serve} onClose={() => setEditing(null)} />}
    </>
  )
}

const tableStateMeta: Record<TableState, { label: string; tone: BadgeProps['tone']; tile: string }> = {
  FREE: { label: 'Livre', tone: 'neutral', tile: 'border-line bg-surface' },
  OCCUPIED: { label: 'Ocupada', tone: 'success', tile: 'border-brand/40 bg-brand-50/70' },
  AWAITING_SERVICE: { label: 'Chamando', tone: 'warning', tile: 'border-warning/50 bg-warning-soft' },
  AWAITING_BILL: { label: 'Pediu a conta', tone: 'info', tile: 'border-info/40 bg-info-soft' },
  UNAVAILABLE: { label: 'Indisponível', tone: 'neutral', tile: 'border-dashed border-line bg-surface-muted/50 opacity-75' },
}

function TableTile({ table: t, onEdit }: { table: RestaurantTable; onEdit?: () => void }) {
  const meta = tableStateMeta[t.state]
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Mesa</span>
        <Badge tone={meta.tone} dot>{meta.label}</Badge>
      </div>
      <span className="mt-1 block truncate text-xl font-semibold text-fg tabular">{t.label}</span>
      {t.openTotalCents > 0 && <span className="block text-sm font-semibold text-fg tabular">{formatCents(t.openTotalCents)}</span>}
      <span className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className={cn('flex items-center gap-1 truncate', t.plate && 'font-medium text-brand-700', t.plate?.status === 'SUSPENDED' && 'text-warning')}>
          <Nfc className="size-3.5 shrink-0" aria-hidden /> {t.plate ? `${t.plate.serial}${t.plate.status === 'SUSPENDED' ? ' (suspensa)' : ''}` : 'Sem plaquinha'}
        </span>
        {t.capacity && <span className="flex shrink-0 items-center gap-1"><Users className="size-3.5" aria-hidden />{t.capacity}</span>}
      </span>
    </>
  )
  const className = cn('block w-full rounded-lg border p-3 text-left transition-colors', meta.tile)
  return onEdit ? (
    <button type="button" onClick={onEdit} className={cn(className, 'hover:border-line-strong focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]')} aria-label={`Mesa ${t.label}: ${meta.label}`}>{content}</button>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** Atendimento da mesa: desde quando, quantos pedidos, valor parcial e encerramento. */
function Attendance({ table: t, canServe, onClosed }: { table: RestaurantTable; canServe: boolean; onClosed: () => void }) {
  const close = useCloseTable()
  const now = useNow()
  const [error, setError] = useState<string | null>(null)
  const open = t.state !== 'FREE' && t.state !== 'UNAVAILABLE'
  if (!open) return <p className="mb-4 rounded-lg bg-surface-muted px-4 py-3 text-sm text-muted">Sem atendimento aberto.</p>

  const submit = async () => {
    setError(null)
    try {
      await close.mutateAsync(t.id)
      toast.success(`Atendimento da mesa ${t.label} encerrado.`)
      onClosed()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível encerrar o atendimento.')
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-line p-4">
      <FormAlert message={error} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone={tableStateMeta[t.state].tone} dot>{tableStateMeta[t.state].label}</Badge>
          <p className="mt-2 text-2xl font-semibold text-fg tabular">{formatCents(t.openTotalCents)}</p>
          <p className="text-xs text-muted">
            {t.openOrders} {t.openOrders === 1 ? 'pedido' : 'pedidos'}{t.activeOrders > 0 && ` · ${t.activeOrders} em andamento`}
            {t.openedAt && <> · <Clock className="inline size-3" aria-hidden /> há {Math.max(0, Math.floor((now - new Date(t.openedAt).getTime()) / 60_000))} min</>}
          </p>
        </div>
        {canServe && <Button variant="secondary" onClick={submit} loading={close.isPending}><DoorOpen aria-hidden /> Encerrar atendimento</Button>}
      </div>
      <TablePayment table={t} />
      <p className="mt-3 text-xs text-muted">Encerrar conclui os pedidos entregues e libera a mesa. Registre o pagamento antes para a mesa não ficar com valores a receber.</p>
    </div>
  )
}

type Mode = 'range' | 'names'

function CreateTablesCard() {
  const create = useCreateTables()
  const [mode, setMode] = useState<Mode>('range')
  const [from, setFrom] = useState('1')
  const [to, setTo] = useState('10')
  const [names, setNames] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const cap = capacity.trim() ? Number(capacity) : undefined
    try {
      const created = await create.mutateAsync(
        mode === 'range'
          ? { from: Number(from), to: Number(to), capacity: cap }
          : { labels: names.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean), capacity: cap },
      )
      toast.success(`${created.length} ${created.length === 1 ? 'mesa cadastrada' : 'mesas cadastradas'}.`)
      setNames('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível cadastrar as mesas.')
    }
  }

  return (
    <Card className="self-start">
      <CardHeader><div><CardTitle>Adicionar mesas</CardTitle><CardDescription>Em sequência numérica ou por nome. O limite do plano é respeitado.</CardDescription></div></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormAlert message={error} />
        <div role="radiogroup" aria-label="Forma de cadastro" className="grid grid-cols-2 rounded-lg bg-surface-muted p-1">
          {(['range', 'names'] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('h-9 rounded-md text-[13px] font-medium transition-colors', mode === m ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg')}>
              {m === 'range' ? 'Numeradas' : 'Por nome'}
            </button>
          ))}
        </div>
        {mode === 'range' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Da mesa"><Input type="number" min={1} max={999} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Até a mesa"><Input type="number" min={1} max={999} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        ) : (
          <Field label="Nomes" hint="Separe por vírgula ou linha. Ex.: Varanda 1, Balcão">
            <Input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Varanda 1, Varanda 2" />
          </Field>
        )}
        <Field label="Lugares por mesa" hint="Opcional"><Input type="number" min={1} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
        <Button onClick={submit} loading={create.isPending}><Plus aria-hidden /> Cadastrar mesas</Button>
      </CardContent>
    </Card>
  )
}

const schema = z.object({
  label: z.string().trim().min(1, 'Informe o nome').max(20, 'Use até 20 caracteres'),
  capacity: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100), 'Entre 1 e 100'),
  active: z.boolean(),
})
type Form = z.infer<typeof schema>

function EditTableDialog({ table, canEdit, canServe, onClose }: { table: RestaurantTable; canEdit: boolean; canServe: boolean; onClose: () => void }) {
  const update = useUpdateTable()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { label: table.label, capacity: table.capacity?.toString() ?? '', active: table.active },
  })
  const active = useWatch({ control, name: 'active' })

  const close = () => { setError(null); onClose() }
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await update.mutateAsync({ id: table.id, label: v.label, capacity: v.capacity ? Number(v.capacity) : null, active: v.active })
      toast.success('Mesa atualizada.')
      close()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar a mesa.')
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={`Mesa ${table.label}`}
      description={table.plate ? `Plaquinha ${table.plate.serial} vinculada. Para trocar a plaquinha, fale com a OneCore Business.` : 'Nenhuma plaquinha vinculada ainda.'}
      footer={canEdit ? <><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" form="table-form" loading={update.isPending}>Salvar</Button></> : <Button variant="secondary" onClick={close}>Fechar</Button>}
    >
      <Attendance table={table} canServe={canServe} onClosed={close} />
      {table.plate && <TableLink url={table.plate.publicUrl} suspended={table.plate.status === 'SUSPENDED'} />}
      <FormAlert message={error} />
      {canEdit && <form id="table-form" onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-4">
        <Field label="Nome ou número" error={errors.label?.message}><Input {...register('label')} /></Field>
        <Field label="Lugares" hint="Opcional" error={errors.capacity?.message}><Input inputMode="numeric" {...register('capacity')} /></Field>
        <label className="col-span-2 flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-fg">Mesa ativa</span>
            <span className="block text-xs text-muted">{active ? 'Recebe pedidos pela plaquinha.' : 'Indisponível: a plaquinha mostra que a mesa não aceita pedidos.'}</span>
          </span>
          <Switch checked={active} onCheckedChange={(v) => setValue('active', v)} aria-label="Mesa ativa" />
        </label>
      </form>}
    </Dialog>
  )
}

/** Link permanente da plaquinha da mesa: o mesmo gravado no NFC e impresso no QR Code. */
function TableLink({ url, suspended }: { url: string; suspended: boolean }) {
  return (
    <div className="mb-5 rounded-lg border border-line p-4">
      <p className="mb-2 text-[13px] font-medium text-fg-secondary">Link do cardápio desta mesa</p>
      <CopyField value={url} label="Link da mesa" />
      {suspended && <p className="mt-2 text-xs text-warning">A plaquinha está suspensa: o link mostra que a mesa não está disponível.</p>}
      <Button asChild variant="secondary" size="sm" className="mt-3">
        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir cardápio da mesa</a>
      </Button>
    </div>
  )
}

/** Valor ainda sem pagamento registrado no atendimento atual da mesa (para quem registra pagamentos). */
function TablePayment({ table }: { table: RestaurantTable }) {
  const { data: me } = useSession()
  const allowed = Boolean(me && can(me, 'PAYMENTS_REGISTER'))
  const pending = usePendingPayments(allowed)
  const [open, setOpen] = useState(false)
  if (!allowed) return null
  const entry = pending.data?.find((p) => p.tableId === table.id)
  const current = entry?.orders.filter((o) => o.currentAttendance) ?? []
  const due = current.reduce((a, o) => a + o.totalCents, 0)
  if (pending.isPending) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2.5">
      <span className="text-[13px] text-fg-secondary">{due > 0 ? <>A receber: <strong className="font-semibold text-fg tabular">{formatCents(due)}</strong></> : 'Pedidos aceitos desta mesa estão pagos.'}</span>
      {due > 0 && <Button size="sm" onClick={() => setOpen(true)}><Receipt aria-hidden /> Receber da mesa</Button>}
      {due > 0 && (
        <RegisterPaymentDialog
          open={open}
          onOpenChange={setOpen}
          title={`Receber da mesa ${table.label}`}
          description={`Pedidos ${current.map((o) => `#${String(o.number).padStart(4, '0')}`).join(', ')}.`}
          totalCents={due}
          target={{ scope: 'TABLE', tableId: table.id }}
        />
      )}
    </div>
  )
}
