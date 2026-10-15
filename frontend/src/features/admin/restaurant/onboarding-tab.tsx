import { useState } from 'react'
import { Ban, Check, Circle, Clock, PauseCircle, Rocket, TimerReset } from 'lucide-react'
import { toast } from 'sonner'
import { ReasonDialog } from '@/components/reason-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useChangeRestaurantStatus, type RestaurantStatusAction } from '@/features/admin/management-api'
import type { Onboarding, RestaurantDetail } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

interface Props {
  restaurant: RestaurantDetail
  onboarding: Onboarding
  onGoTo: (tab: string) => void
}

const stepTab: Record<string, string> = { details: 'dados', branding: 'identidade', plan: 'plano', owner: 'proprietario', tables: 'mesas', plates: 'plaquinhas' }

export function OnboardingTab({ restaurant, onboarding: o, onGoTo }: Props) {
  const change = useChangeRestaurantStatus(restaurant.id)
  const [action, setAction] = useState<RestaurantStatusAction | null>(null)
  const status = restaurant.status
  const canStart = status === 'ONBOARDING'
  const canActivate = status === 'ONBOARDING' || status === 'TRIAL' || status === 'SUSPENDED'

  const copy: Record<RestaurantStatusAction, { title: string; description: string; confirm: string; danger?: boolean; reason: boolean }> = {
    ACTIVATE: { title: 'Ativar restaurante', description: 'O cardápio passa a abrir pelas plaquinhas vinculadas.', confirm: 'Ativar', reason: false },
    START_TRIAL: { title: 'Iniciar período de teste', description: `O teste dura ${o.plan?.trialDays ?? 0} dias conforme o plano ${o.plan?.name ?? ''}.`, confirm: 'Iniciar teste', reason: false },
    SUSPEND: { title: 'Suspender restaurante', description: 'A equipe perde o acesso imediatamente e o cardápio deixa de abrir.', confirm: 'Suspender', danger: true, reason: true },
    CANCEL: { title: 'Cancelar restaurante', description: 'Encerra a conta. A equipe perde o acesso e o histórico é preservado.', confirm: 'Cancelar conta', danger: true, reason: true },
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Checklist de implantação</CardTitle>
            <CardDescription>{o.done} de {o.total} etapas concluídas. Calculado a partir dos dados reais.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(o.done / o.total) * 100}%` }} />
          </div>
          <ol className="flex flex-col">
            {o.steps.map((step) => {
              const tab = stepTab[step.key]
              return (
                <li key={step.key} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  {step.done ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Check className="size-3" strokeWidth={3} aria-hidden /></span>
                  ) : step.available ? (
                    <Circle className="size-5 shrink-0 text-line-strong" aria-hidden />
                  ) : (
                    <Clock className="size-5 shrink-0 text-muted" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', step.done ? 'text-fg' : 'text-fg-secondary')}>{step.label}<span className="sr-only">{step.done ? ' concluída' : ' pendente'}</span></p>
                    {step.detail && <p className="text-xs text-muted">{step.detail}</p>}
                  </div>
                  {tab && !step.done && (
                    <Button variant="ghost" size="sm" onClick={() => onGoTo(tab)}>Configurar</Button>
                  )}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader><div><CardTitle>Situação da conta</CardTitle><CardDescription>Ativação, teste, suspensão e cancelamento.</CardDescription></div></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[13px] text-muted">Ativado em</dt><dd className="font-medium text-fg">{o.activatedAt ? formatDate(o.activatedAt) : 'Não ativado'}</dd></div>
            <div><dt className="text-[13px] text-muted">Fim do teste</dt><dd className="font-medium text-fg">{o.trialEndsAt ? formatDate(o.trialEndsAt) : 'Sem teste'}</dd></div>
          </dl>
          {o.statusReason && (status === 'SUSPENDED' || status === 'CANCELLED') && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">Motivo: {o.statusReason}</p>
          )}
          {!o.readyToActivate && canActivate && (
            <div className="rounded-lg border border-line bg-surface-muted px-3.5 py-3">
              <p className="text-[13px] font-medium text-fg-secondary">Para ativar, falta:</p>
              <ul className="mt-1.5 list-disc pl-4 text-[13px] text-muted">{o.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {canActivate && (
              <Button onClick={() => setAction('ACTIVATE')} disabled={!o.readyToActivate}><Rocket aria-hidden /> {status === 'SUSPENDED' ? 'Reativar restaurante' : 'Ativar restaurante'}</Button>
            )}
            {canStart && (o.plan?.trialDays ?? 0) > 0 && (
              <Button variant="secondary" onClick={() => setAction('START_TRIAL')} disabled={!o.readyToActivate}><TimerReset aria-hidden /> Iniciar teste de {o.plan?.trialDays} dias</Button>
            )}
            {(status === 'ACTIVE' || status === 'TRIAL') && (
              <Button variant="secondary" onClick={() => setAction('SUSPEND')}><PauseCircle aria-hidden /> Suspender</Button>
            )}
            {status !== 'CANCELLED' && (
              <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setAction('CANCEL')}><Ban aria-hidden /> Cancelar conta</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {action && (
        <ReasonDialog
          open
          onOpenChange={(open) => !open && setAction(null)}
          title={copy[action].title}
          description={copy[action].description}
          confirmLabel={copy[action].confirm}
          tone={copy[action].danger ? 'danger' : 'primary'}
          requireReason={copy[action].reason}
          onConfirm={async (reason) => {
            await change.mutateAsync({ action, reason: reason || undefined })
            toast.success('Situação do restaurante atualizada.')
          }}
        />
      )}
    </div>
  )
}
