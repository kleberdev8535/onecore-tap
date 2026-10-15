import { useState } from 'react'
import { Copy, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { OpeningHour } from '@/types/api'
import { useUpdateHours } from '../api'
import { validateDay, type Range } from './hours-rules'

const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

type Week = Range[][]

const hhmm = (t: string) => t.slice(0, 5)

function toWeek(hours: OpeningHour[]): Week {
  const week: Week = weekdays.map(() => [])
  hours.forEach((h) => week[h.weekday - 1].push({ opensAt: hhmm(h.opensAt), closesAt: hhmm(h.closesAt) }))
  return week
}

export function HoursEditor({ hours }: { hours: OpeningHour[] }) {
  const save = useUpdateHours()
  const [week, setWeek] = useState<Week>(() => toWeek(hours))
  const [error, setError] = useState<string | null>(null)
  const problems = week.map(validateDay)
  const invalid = problems.some(Boolean)

  const update = (day: number, fn: (ranges: Range[]) => Range[]) => setWeek((w) => w.map((r, i) => (i === day ? fn(r) : r)))
  const copyToAll = (day: number) => {
    setWeek((w) => w.map(() => w[day].map((r) => ({ ...r }))))
    toast.success(`Horário de ${weekdays[day].toLowerCase()} copiado para todos os dias.`)
  }

  const submit = async () => {
    setError(null)
    const payload: OpeningHour[] = week.flatMap((ranges, i) => ranges.map((r) => ({ weekday: i + 1, opensAt: r.opensAt, closesAt: r.closesAt })))
    try {
      await save.mutateAsync(payload)
      toast.success('Horário de funcionamento salvo.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar os horários.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Horário de funcionamento</CardTitle>
          <CardDescription>Exibido no cardápio. Use mais de uma faixa para almoço e jantar; fechamento depois da meia-noite é aceito.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <FormAlert message={error} />
        <ul className="flex flex-col divide-y divide-line">
          {week.map((ranges, day) => {
            const open = ranges.length > 0
            return (
              <li key={weekdays[day]} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <div className="flex w-full items-center justify-between gap-3 sm:w-44 sm:pt-2">
                  <span className="text-sm font-medium text-fg">{weekdays[day]}</span>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    {open ? 'Aberto' : 'Fechado'}
                    <Switch checked={open} onCheckedChange={(v) => update(day, () => (v ? [{ opensAt: '11:00', closesAt: '23:00' }] : []))} aria-label={`${weekdays[day]} aberto`} />
                  </label>
                </div>
                {open && (
                  <div className="flex flex-1 flex-col gap-2">
                    {ranges.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input type="time" aria-label={`${weekdays[day]}: abertura da faixa ${i + 1}`} value={r.opensAt} onChange={(e) => update(day, (rs) => rs.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))} className="w-32" />
                        <span className="text-sm text-muted">às</span>
                        <Input type="time" aria-label={`${weekdays[day]}: fechamento da faixa ${i + 1}`} value={r.closesAt} onChange={(e) => update(day, (rs) => rs.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))} className="w-32" />
                        {ranges.length > 1 && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover faixa ${i + 1} de ${weekdays[day]}`} onClick={() => update(day, (rs) => rs.filter((_, j) => j !== i))}><X /></Button>}
                      </div>
                    ))}
                    {problems[day] && <p className="text-xs font-medium text-danger" role="alert">{problems[day]}</p>}
                    <div className="flex flex-wrap gap-2">
                      {ranges.length < 3 && <Button type="button" variant="ghost" size="sm" onClick={() => update(day, (rs) => [...rs, { opensAt: '18:00', closesAt: '23:00' }])}><Plus aria-hidden /> Faixa</Button>}
                      <Button type="button" variant="ghost" size="sm" onClick={() => copyToAll(day)}><Copy aria-hidden /> Copiar para todos</Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end pt-2">
          <Button onClick={submit} loading={save.isPending} disabled={invalid}>Salvar horários</Button>
        </div>
      </CardContent>
    </Card>
  )
}
