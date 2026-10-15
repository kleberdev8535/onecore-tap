import { useEffect, type CSSProperties } from 'react'
import type { PublicMenu, PublicMenuGroup } from '@/types/api'
import { contrastRatio, isHexColor, readableTextOn } from '@/utils/color'

/**
 * Escolha de opção respeitando a regra do grupo: grupo de escolha única troca a opção; os demais adicionam até o
 * máximo (além disso, o toque é ignorado).
 */
export function toggleOption(group: PublicMenuGroup, selected: string[], optionId: string): string[] {
  const inGroup = new Set(group.options.map((o) => o.id))
  const current = selected.filter((id) => inGroup.has(id))
  const others = selected.filter((id) => !inGroup.has(id))
  if (current.includes(optionId)) {
    // Em variação obrigatória (mín. = máx. = 1) tocar de novo mantém a escolha.
    if (group.maxChoices === 1 && group.minChoices === 1) return selected
    return [...others, ...current.filter((id) => id !== optionId)]
  }
  if (group.maxChoices === 1) return [...others, optionId]
  if (current.length >= group.maxChoices) return selected
  return [...others, ...current, optionId]
}

export interface GroupStatus {
  group: PublicMenuGroup
  count: number
  missing: number
  full: boolean
}

export function groupStatus(groups: PublicMenuGroup[], selected: string[]): GroupStatus[] {
  return groups.map((group) => {
    const count = group.options.filter((o) => selected.includes(o.id)).length
    return { group, count, missing: Math.max(0, group.minChoices - count), full: count >= group.maxChoices }
  })
}

/** Preço exibido ao cliente antes de enviar. O servidor recalcula tudo a partir do cardápio. */
export function estimateUnit(basePriceCents: number, groups: PublicMenuGroup[], selected: string[]) {
  return groups.flatMap((g) => g.options).filter((o) => selected.includes(o.id)).reduce((sum, o) => sum + o.priceCents, basePriceCents)
}

export function ruleLabel(g: PublicMenuGroup) {
  if (g.minChoices === 1 && g.maxChoices === 1) return 'Obrigatório · escolha 1'
  if (g.minChoices > 0) return `Obrigatório · ${g.minChoices === g.maxChoices ? `escolha ${g.minChoices}` : `de ${g.minChoices} a ${g.maxChoices}`}`
  return g.maxChoices === 1 ? 'Opcional · até 1' : `Opcional · até ${g.maxChoices}`
}

/**
 * Cores do restaurante como variáveis CSS. Texto sobre as cores escolhidas alterna entre branco e preto pelo
 * contraste; o preço só usa a cor principal se ela for legível sobre o branco.
 */
export function menuTheme(primary: string, accent: string): CSSProperties {
  const p = isHexColor(primary) ? primary : '#16A36B'
  const a = isHexColor(accent) ? accent : '#0B0F0E'
  return {
    '--m-primary': p,
    '--m-on-primary': readableTextOn(p),
    '--m-accent': a,
    '--m-on-accent': readableTextOn(a),
    '--m-ink': contrastRatio(p, '#FFFFFF') >= 4.5 ? p : '#0B0F0E',
  } as CSSProperties
}

export const weekdayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

/** Aplica as cores do restaurante também às folhas (portais), que ficam fora da árvore da página. */
export function useMenuTheme(menu: PublicMenu | undefined) {
  useEffect(() => {
    if (!menu) return
    const vars = menuTheme(menu.restaurant.primaryColor, menu.restaurant.accentColor) as Record<string, string>
    Object.entries(vars).forEach(([k, v]) => document.body.style.setProperty(k, v))
    return () => Object.keys(vars).forEach((k) => document.body.style.removeProperty(k))
  }, [menu])
}
