const numberFormat = new Intl.NumberFormat('pt-BR')
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export const formatNumber = (value: number) => numberFormat.format(value)

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

const currencyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatCents = (cents: number) => currencyFormat.format(cents / 100)

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

/** "149,90" | "149.90" | "149" -> 14990 centavos. Retorna null se invalido. */
export function parseCents(input: string): number | null {
  const normalized = input.trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

/** "1 produto" / "3 produtos", com o número formatado. */
export const plural = (n: number, singular: string, pluralForm: string) => `${formatNumber(n)} ${n === 1 ? singular : pluralForm}`
