import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  /** Slug usado na URL. */
  key: string
  label: string
  icon: LucideIcon
  /** Rota da tela pronta. Ausente = módulo planejado (abre a página de roadmap). */
  path?: string
  /** Fase do roadmap em que o módulo é entregue. */
  phase: number
  summary: string
  scope: string[]
  /** Permissão exigida para ver o item (o backend também valida). */
  permission?: string
  /** Módulo do plano exigido (KITCHEN, FINANCE, REPORTS). */
  module?: string
  /** Calculado: o plano do restaurante não inclui o módulo. */
  locked?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Rota da tela pronta ou da página do módulo planejado dentro do painel. */
export function navHref(item: NavItem, modulesBase: string) {
  if (item.locked) return `${modulesBase}/${item.key}`
  return item.path ?? `${modulesBase}/${item.key}`
}
