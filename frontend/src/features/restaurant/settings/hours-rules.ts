export type Range = { opensAt: string; closesAt: string }

/** Regras iguais às do backend, para avisar antes de enviar. */
export function validateDay(ranges: Range[]): string | null {
  const sorted = [...ranges].sort((a, b) => a.opensAt.localeCompare(b.opensAt))
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    if (!r.opensAt || !r.closesAt) return 'Preencha abertura e fechamento.'
    if (r.opensAt === r.closesAt) return 'Abertura e fechamento iguais.'
    const overnight = r.closesAt <= r.opensAt
    if (overnight && i < sorted.length - 1) return 'A faixa que vira a noite deve ser a última do dia.'
    if (i > 0 && sorted[i - 1].closesAt > r.opensAt) return 'Faixas sobrepostas.'
  }
  return null
}
