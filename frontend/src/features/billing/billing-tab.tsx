import { useState } from 'react'
import { Ban, CircleAlert, Nfc, Plus, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import { formatCents, formatDateTime } from '@/utils/format'
import { receiptMethodLabels, useBillingDetail, usePayInvoice, usePayPlateSale, useRegisterPlateSale, useVoidInvoice, useVoidPlateSale, type Invoice, type PlateSale } from './api'
import { chargeMeta, formatIsoDay, subscriptionMeta } from './billing-meta'
import { ReceiptDialog } from './receipt-dialog'

/** Aba "Cobrança" do restaurante no Super Admin: assinatura, cobranças mensais e venda de plaquinhas. */
export function BillingTab({ restaurantId }: { restaurantId: string }) {
  const detail = useBillingDetail(restaurantId)
  if (detail.isPending) return <Skeleton className="h-64 w-full rounded-xl" aria-busy />
  if (detail.isError) return <p className="text-sm text-danger">{detail.error.message}</p>
  const d = detail.data
  const s = d?.subscription

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><div><CardTitle>Assinatura</CardTitle><CardDescription>Criada ao ativar ou iniciar o teste. Trocar de plano vale a partir da próxima cobrança.</CardDescription></div></CardHeader>
        <CardContent>
          {!s ? (
            <p className="text-sm text-muted">Sem assinatura ainda: ela nasce quando o restaurante é ativado ou entra em teste (aba Implantação).</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Info label="Situação"><Badge tone={subscriptionMeta[s.status].tone} dot>{subscriptionMeta[s.status].label}</Badge></Info>
                <Info label="Plano">{s.planName} · {formatCents(s.priceCents)}/mês</Info>
                <Info label={s.status === 'TRIALING' ? 'Fim do teste' : 'Período atual'}>
                  {s.status === 'TRIALING' ? (s.trialEndsAt ? formatDateTime(s.trialEndsAt) : '-') : s.currentPeriodStart && s.currentPeriodEnd ? `${formatIsoDay(s.currentPeriodStart)} a ${formatIsoDay(s.currentPeriodEnd)}` : '-'}
                </Info>
                <Info label="Em atraso"><span className={s.overdueCents > 0 ? 'font-semibold text-warning' : ''}>{formatCents(s.overdueCents)}</span></Info>
              </dl>
              {s.suspendedByBilling && (
                <p className="mt-4 flex gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Suspenso pela rotina de cobrança após {d?.graceDays} dias de carência. Registrar o recebimento das cobranças vencidas reativa automaticamente.
                </p>
              )}
              <p className="mt-4 text-xs text-muted">
                Cobranças registradas manualmente{s.provider ? ` (provedor: ${s.provider})` : ''}. A integração com provedor de pagamento (ex.: Mercado Pago) ainda não está ativa.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader><div><CardTitle>Cobranças da assinatura</CardTitle><CardDescription>Uma por mês, vencendo no início do período.</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          {(d?.invoices.length ?? 0) === 0 ? <p className="px-5 pb-5 text-sm text-muted">Nenhuma cobrança emitida.</p> : (
            <ul className="divide-y divide-line border-t border-line">{d!.invoices.map((i) => <InvoiceRow key={i.id} invoice={i} />)}</ul>
          )}
        </CardContent>
      </Card>

      <PlateSalesCard restaurantId={restaurantId} sales={d?.plateSales ?? []} />
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-fg">{children}</dd>
    </div>
  )
}

function InvoiceRow({ invoice: i }: { invoice: Invoice }) {
  const pay = usePayInvoice()
  const voidInvoice = useVoidInvoice()
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState(false)
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-fg tabular">{formatCents(i.amountCents)}</span>
          {i.overdue ? <Badge tone="warning" dot>Vencida</Badge> : <Badge tone={chargeMeta[i.status].tone} dot>{chargeMeta[i.status].label}</Badge>}
        </div>
        <p className="mt-0.5 text-[13px] text-muted">
          {i.planName} · {formatIsoDay(i.periodStart)} a {formatIsoDay(i.periodEnd)} · vence {formatIsoDay(i.dueDate)}
          {i.paidAt && ` · recebida em ${formatDateTime(i.paidAt)} (${receiptMethodLabels[i.paymentMethod!]})`}
        </p>
        {i.notes && <p className="text-xs text-fg-secondary">{i.notes}</p>}
        {i.voidReason && <p className="text-xs text-muted">Anulada: {i.voidReason}</p>}
      </div>
      {i.status === 'OPEN' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setPaying(true)}><Receipt aria-hidden /> Registrar recebimento</Button>
          <Button size="sm" variant="ghost" onClick={() => setVoiding(true)}><Ban aria-hidden /> Anular</Button>
        </div>
      )}
      <ReceiptDialog open={paying} onOpenChange={setPaying} title="Recebimento da cobrança" amountCents={i.amountCents} onConfirm={(input) => pay.mutateAsync({ id: i.id, ...input })} />
      {voiding && (
        <ReasonDialog open onOpenChange={(o) => !o && setVoiding(false)} title="Anular cobrança" description="Use para cobranças emitidas por engano ou negociadas. Fica registrado na auditoria." confirmLabel="Anular cobrança" tone="danger"
          onConfirm={async (reason) => { await voidInvoice.mutateAsync({ id: i.id, reason }); toast.success('Cobrança anulada.') }} />
      )}
    </li>
  )
}

function PlateSalesCard({ restaurantId, sales }: { restaurantId: string; sales: PlateSale[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div><CardTitle>Venda de plaquinhas</CardTitle><CardDescription>O preço unitário fica congelado na venda.</CardDescription></div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus aria-hidden /> Registrar venda</Button>
      </CardHeader>
      <CardContent className="p-0">
        {sales.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Nenhuma venda registrada.</p> : (
          <ul className="divide-y divide-line border-t border-line">{sales.map((s) => <PlateSaleRow key={s.id} sale={s} />)}</ul>
        )}
      </CardContent>
      <NewPlateSaleDialog restaurantId={restaurantId} open={open} onOpenChange={setOpen} />
    </Card>
  )
}

function PlateSaleRow({ sale: s }: { sale: PlateSale }) {
  const pay = usePayPlateSale()
  const voidSale = useVoidPlateSale()
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState(false)
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Nfc className="size-4 text-muted" aria-hidden />
          <span className="font-semibold text-fg tabular">{formatCents(s.totalCents)}</span>
          <Badge tone={chargeMeta[s.status].tone} dot>{chargeMeta[s.status].label}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-muted">
          {s.quantity} x {formatCents(s.unitPriceCents)} · {formatDateTime(s.createdAt)}
          {s.paidAt && ` · recebida (${receiptMethodLabels[s.paymentMethod!]})`}
        </p>
        {s.notes && <p className="text-xs text-fg-secondary">{s.notes}</p>}
      </div>
      {s.status === 'OPEN' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setPaying(true)}><Receipt aria-hidden /> Registrar recebimento</Button>
          <Button size="sm" variant="ghost" onClick={() => setVoiding(true)}><Ban aria-hidden /> Anular</Button>
        </div>
      )}
      <ReceiptDialog open={paying} onOpenChange={setPaying} title="Recebimento da venda" amountCents={s.totalCents} withDetails={false} onConfirm={({ method }) => pay.mutateAsync({ id: s.id, method })} />
      {voiding && (
        <ReasonDialog open onOpenChange={(o) => !o && setVoiding(false)} title="Anular venda" description="A venda continua no histórico com o motivo." confirmLabel="Anular venda" tone="danger"
          onConfirm={async (reason) => { await voidSale.mutateAsync({ id: s.id, reason }); toast.success('Venda anulada.') }} />
      )}
    </li>
  )
}

function NewPlateSaleDialog({ restaurantId, open, onOpenChange }: { restaurantId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const settings = useSettings()
  const register = useRegisterPlateSale(restaurantId)
  const [quantity, setQuantity] = useState('10')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qty = Number(quantity)
  const valid = Number.isInteger(qty) && qty >= 1 && qty <= 1000
  const price = settings.data?.platePriceCents ?? 0

  const submit = async () => {
    if (!valid) return
    setError(null)
    try {
      await register.mutateAsync({ quantity: qty, notes: notes.trim() || undefined })
      toast.success('Venda registrada.', { description: formatCents(qty * price) })
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível registrar.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Registrar venda de plaquinhas" description={`Preço atual: ${formatCents(price)} por plaquinha (Configurações).`}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} loading={register.isPending} disabled={!valid}>Registrar {valid ? formatCents(qty * price) : ''}</Button></>}>
      <FormAlert message={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Quantidade" error={valid ? undefined : 'Entre 1 e 1000'}><Input type="number" min={1} max={1000} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Observação" hint="Opcional"><Input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Dialog>
  )
}
