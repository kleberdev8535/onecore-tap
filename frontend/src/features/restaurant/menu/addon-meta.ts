import type { AddonGroup } from '@/types/api'

/** Variação = escolha obrigatória de exatamente uma opção (ex.: Tamanho). */
export const isVariation = (g: Pick<AddonGroup, 'minChoices' | 'maxChoices'>) => g.minChoices === 1 && g.maxChoices === 1

/** Regra de escolha em linguagem do cliente. */
export function choiceRule(g: Pick<AddonGroup, 'minChoices' | 'maxChoices'>) {
  if (isVariation(g)) return 'Escolha obrigatória de 1 opção'
  if (g.minChoices === 0) return g.maxChoices === 1 ? 'Opcional, até 1 opção' : `Opcional, até ${g.maxChoices} opções`
  if (g.minChoices === g.maxChoices) return `Escolha ${g.minChoices} opções`
  return `Escolha de ${g.minChoices} a ${g.maxChoices} opções`
}

export const groupKindLabel = (g: Pick<AddonGroup, 'minChoices' | 'maxChoices'>) => (isVariation(g) ? 'Variação' : 'Adicionais')
