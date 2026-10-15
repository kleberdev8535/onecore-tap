export type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom'

export interface Period {
  preset: PeriodPreset
  from: string
  to: string
}

const ZONE = 'America/Sao_Paulo'

/** Data de hoje (AAAA-MM-DD) no fuso do restaurante, independente do fuso do aparelho. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function periodFor(preset: Exclude<PeriodPreset, 'custom'>): Period {
  const today = todayIso()
  switch (preset) {
    case '7d':
      return { preset, from: addDays(today, -6), to: today }
    case '30d':
      return { preset, from: addDays(today, -29), to: today }
    case 'month':
      return { preset, from: `${today.slice(0, 8)}01`, to: today }
    default:
      return { preset, from: today, to: today }
  }
}

export const formatDay = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

export const describePeriod = (from: string, to: string) => (from === to ? formatDay(from) : `${formatDay(from)} a ${formatDay(to)}`)
