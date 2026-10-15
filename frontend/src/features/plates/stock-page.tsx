import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, CircleAlert, FileDown, Plus, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBatches, useCreateBatch, usePlateCounts } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { PlateBatch } from '@/types/api'
import { downloadFile } from '@/utils/download'
import { formatDate, formatNumber } from '@/utils/format'

export function StockPage() {
  const [params, setParams] = useSearchParams()
  const batches = useBatches()
  const counts = usePlateCounts()
  const createOpen = params.get('novo') === '1'
  const setCreateOpen = (open: boolean) => setParams(open ? { novo: '1' } : {}, { replace: true })

  const stats = counts.data
    ? [
        { label: 'Disponíveis em estoque', value: counts.data.available },
        { label: 'Em uso (vinculadas)', value: counts.data.active + counts.data.reserved + counts.data.suspended },
        { label: 'Danificadas', value: counts.data.damaged },
        { label: 'Desativadas', value: counts.data.deactivated },
      ]
    : null

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Estoque"
        description="Lotes de plaquinhas fabricadas. Cada lote gera tokens únicos e um PDF de produção com os QR Codes."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden /> Novo lote</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {(stats ?? Array.from({ length: 4 }, () => null)).map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 sm:p-5">
              {s ? (
                <>
                  <p className="text-[13px] font-medium text-muted">{s.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-fg tabular">{formatNumber(s.value)}</p>
                </>
              ) : (
                <>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-7 w-12" />
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {batches.isPending && (
          <div className="divide-y divide-line" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-4"><Skeleton className="h-4 w-48" /><Skeleton className="mt-2 h-3 w-32" /></div>
            ))}
          </div>
        )}
        {batches.isError && (
          <EmptyState icon={CircleAlert} title="Não foi possível carregar os lotes" description={batches.error.message} action={<Button variant="secondary" onClick={() => batches.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />
        )}
        {batches.data?.length === 0 && (
          <EmptyState icon={Boxes} title="Nenhum lote cadastrado" description="Registre o primeiro lote para gerar as plaquinhas e o arquivo de impressão." action={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden /> Cadastrar lote</Button>} />
        )}
        {batches.data && batches.data.length > 0 && (
          <ul className="divide-y divide-line">
            {batches.data.map((b) => <BatchRow key={b.id} batch={b} />)}
          </ul>
        )}
      </Card>

      <CreateBatchDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

function BatchRow({ batch }: { batch: PlateBatch }) {
  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    try {
      await downloadFile(`/admin/plate-batches/${batch.id}/labels.pdf`, `onecore-tap-${batch.code}.pdf`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível gerar o PDF.')
    } finally {
      setDownloading(false)
    }
  }
  const usage = batch.quantity === 0 ? 0 : (batch.inUse / batch.quantity) * 100

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-fg">{batch.code}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          {formatNumber(batch.quantity)} plaquinhas · cadastrado em {formatDate(batch.createdAt)}
          {batch.manufacturedOn && ` · fabricado em ${formatDate(batch.manufacturedOn + 'T12:00:00')}`}
        </p>
        {batch.notes && <p className="mt-1 text-[13px] text-fg-secondary">{batch.notes}</p>}
      </div>
      <div className="w-full sm:w-48">
        <div className="flex justify-between text-xs text-muted">
          <span>{formatNumber(batch.inUse)} em uso</span>
          <span>{formatNumber(batch.available)} disponíveis</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${usage}%` }} />
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={download} loading={downloading} className="self-start sm:self-auto">
        <FileDown aria-hidden /> PDF de impressão
      </Button>
    </li>
  )
}

const batchSchema = z.object({
  code: z.string().trim().refine((v) => v === '' || /^[A-Za-z0-9-]{3,40}$/.test(v), 'Use de 3 a 40 letras, números ou hífens'),
  manufacturedOn: z.string(),
  quantity: z.coerce.number({ invalid_type_error: 'Informe a quantidade' }).int('Use um número inteiro').min(1, 'Mínimo de 1').max(500, 'Máximo de 500 por lote'),
  notes: z.string().max(300),
})
type BatchInput = z.input<typeof batchSchema>
type BatchOutput = z.output<typeof batchSchema>

function CreateBatchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateBatch()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BatchInput, unknown, BatchOutput>({
    resolver: zodResolver(batchSchema),
    defaultValues: { code: '', manufacturedOn: '', quantity: 10, notes: '' },
  })

  const close = (next: boolean) => {
    if (!next) {
      reset()
      setError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      const batch = await create.mutateAsync({
        code: v.code || undefined,
        manufacturedOn: v.manufacturedOn || undefined,
        quantity: v.quantity,
        notes: v.notes || undefined,
      })
      toast.success(`Lote ${batch.code} cadastrado`, { description: `${batch.quantity} plaquinhas disponíveis no estoque.` })
      close(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível cadastrar o lote.')
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Novo lote de plaquinhas"
      description="Cada plaquinha recebe um serial e um token aleatório. O link permanente é gerado na hora."
      footer={<><Button variant="secondary" onClick={() => close(false)}>Cancelar</Button><Button type="submit" form="create-batch" loading={create.isPending}>Gerar plaquinhas</Button></>}
    >
      <FormAlert message={error} />
      <form id="create-batch" onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Quantidade" error={errors.quantity?.message}>
          <Input type="number" inputMode="numeric" min={1} max={500} autoFocus {...register('quantity')} />
        </Field>
        <Field label="Data de fabricação" hint="Opcional" error={errors.manufacturedOn?.message}>
          <Input type="date" {...register('manufacturedOn')} />
        </Field>
        <Field label="Código do lote" hint="Opcional. Gerado automaticamente se vazio." error={errors.code?.message} className="sm:col-span-2">
          <Input placeholder="Ex.: LOTE-2026-10-A" {...register('code')} />
        </Field>
        <Field label="Observações" hint="Opcional" error={errors.notes?.message} className="sm:col-span-2">
          <Input placeholder="Fornecedor, acabamento..." {...register('notes')} />
        </Field>
      </form>
    </Dialog>
  )
}
