import { useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateTables, usePlates, useRestaurantTables } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { Onboarding } from '@/types/api'
import { cn } from '@/utils/cn'

type Mode = 'range' | 'names'

export function TablesTab({ restaurantId, onboarding }: { restaurantId: string; onboarding: Onboarding }) {
  const tables = useRestaurantTables(restaurantId)
  const plates = usePlates({ search: '', status: '', restaurantId, page: 0 })
  const create = useCreateTables(restaurantId)
  const [mode, setMode] = useState<Mode>('range')
  const [from, setFrom] = useState('1')
  const [to, setTo] = useState('10')
  const [names, setNames] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [error, setError] = useState<string | null>(null)
  const plateByTable = new Map((plates.data?.items ?? []).filter((p) => p.table).map((p) => [p.table!.id, p]))
  const max = onboarding.plan?.maxTables

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Mesas</CardTitle>
            <CardDescription>{tables.data?.length ?? 0} cadastradas{max ? ` de ${max} permitidas pelo plano` : ''}.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {tables.isPending && <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>}
          {tables.data?.length === 0 && <EmptyState className="py-8" icon={LayoutGrid} title="Nenhuma mesa" description="Cadastre as mesas para vincular as plaquinhas." />}
          {tables.data && tables.data.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
              {tables.data.map((t) => {
                const plate = plateByTable.get(t.id)
                return (
                  <li key={t.id} className={cn('flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center', plate ? 'border-brand/30 bg-brand-50' : 'border-line bg-surface')}>
                    <span className="text-[11px] uppercase tracking-wide text-muted">Mesa</span>
                    <span className="text-lg font-semibold text-fg tabular">{t.label}</span>
                    <span className={cn('mt-0.5 truncate text-[11px]', plate ? 'font-medium text-brand-700' : 'text-muted')}>{plate ? plate.serial : 'sem plaquinha'}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader><div><CardTitle>Adicionar mesas</CardTitle><CardDescription>Em sequência numérica ou por nome.</CardDescription></div></CardHeader>
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
    </div>
  )
}
