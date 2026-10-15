import { cn } from '@/utils/cn'
import { Input } from '@/components/ui/input'

import { periodFor, todayIso, type Period, type PeriodPreset } from './period-utils'

const presets: { value: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'month', label: 'Este mês' },
]

/** Filtro de período em uma linha: atalhos + datas livres (até 366 dias, validado também no servidor). */
export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div role="radiogroup" aria-label="Período" className="flex gap-1 overflow-x-auto rounded-lg bg-surface-muted p-1 [scrollbar-width:none]">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value.preset === p.value}
            onClick={() => onChange(periodFor(p.value))}
            className={cn(
              'h-9 shrink-0 rounded-md px-3 text-[13px] font-medium transition-colors',
              value.preset === p.value ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input type="date" aria-label="Data inicial" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ preset: 'custom', from: e.target.value, to: value.to })} />
        <span className="text-sm text-muted">a</span>
        <Input type="date" aria-label="Data final" value={value.to} min={value.from} max={todayIso()} onChange={(e) => e.target.value && onChange({ preset: 'custom', from: value.from, to: e.target.value })} />
      </div>
    </div>
  )
}
