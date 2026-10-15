import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAssignPlan, usePlans } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { Onboarding } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatCents } from '@/utils/format'

export function PlanTab({ restaurantId, onboarding }: { restaurantId: string; onboarding: Onboarding }) {
  const plans = usePlans()
  const assign = useAssignPlan(restaurantId)
  const [selected, setSelected] = useState<string | null>(onboarding.plan?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const changed = selected !== null && selected !== onboarding.plan?.id

  const save = async () => {
    if (!selected) return
    setError(null)
    try {
      await assign.mutateAsync(selected)
      toast.success('Plano definido.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível definir o plano.')
    }
  }

  if (plans.isPending) return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
  const active = plans.data?.filter((p) => p.active || p.id === onboarding.plan?.id) ?? []
  if (active.length === 0) {
    return <Card><EmptyState icon={Layers} title="Nenhum plano ativo" description="Cadastre os planos comerciais antes de definir o plano deste restaurante." action={<Button asChild><Link to="/admin/planos">Cadastrar planos</Link></Button>} /></Card>
  }

  return (
    <div className="max-w-4xl">
      <FormAlert message={error} />
      <div role="radiogroup" aria-label="Plano do restaurante" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {active.map((p) => {
          const checked = selected === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setSelected(p.id)}
              className={cn('relative rounded-xl border bg-surface p-5 text-left shadow-card transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]', checked ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong')}
            >
              {checked && <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-brand text-white"><Check className="size-3" strokeWidth={3} aria-hidden /></span>}
              <p className="font-semibold text-fg">{p.name}</p>
              <p className="mt-2 text-xl font-semibold text-fg tabular">{formatCents(p.monthlyPriceCents)}<span className="text-sm font-normal text-muted">/mês</span></p>
              <p className="mt-2 text-[13px] text-muted">
                {p.maxTables ? `Até ${p.maxTables} mesas` : 'Mesas ilimitadas'} · {p.maxUsers ? `${p.maxUsers} usuários` : 'usuários ilimitados'}
                {p.trialDays > 0 && ` · ${p.trialDays} dias de teste`}
              </p>
            </button>
          )
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={!changed} loading={assign.isPending}>Salvar plano</Button>
      </div>
    </div>
  )
}
