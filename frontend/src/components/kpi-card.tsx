import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/utils/format'

/** display: valor já formatado (ex.: dinheiro); sem ele, value é formatado como número. */
export function KpiCard({ icon: Icon, label, value, display, hint, accent }: { icon: LucideIcon; label: string; value: number; display?: string; hint: string; accent?: boolean }) {
  return (
    <Card className="group h-full transition-shadow duration-200 hover:shadow-pop">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium leading-snug text-muted">{label}</p>
          <span className={accent ? 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700' : 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-secondary'}>
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
        </div>
        <p className="mt-3 text-[26px] sm:text-[32px] font-semibold leading-none tracking-tight text-fg tabular">{display ?? formatNumber(value)}</p>
        <p className="mt-2 text-[13px] text-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}
