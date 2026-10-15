import type { BadgeProps } from '@/components/ui/badge'
import type { OrderStatus, OrderView, ServiceRequestType } from '@/types/api'

export const statusMeta: Record<OrderStatus, { label: string; tone: BadgeProps['tone'] }> = {
  AWAITING_CONFIRMATION: { label: 'Aguardando confirmação', tone: 'warning' },
  NEW: { label: 'Novo', tone: 'info' },
  IN_PREPARATION: { label: 'Em preparo', tone: 'warning' },
  READY: { label: 'Pronto', tone: 'success' },
  DELIVERED: { label: 'Entregue', tone: 'neutral' },
  COMPLETED: { label: 'Concluído', tone: 'neutral' },
  CANCELLED: { label: 'Cancelado', tone: 'danger' },
}

export const requestLabels: Record<ServiceRequestType, string> = {
  CALL_WAITER: 'Chamou o garçom',
  REQUEST_BILL: 'Pediu a conta',
}

/** Colunas do Kanban, na ordem da operação. "Novos" reúne os que aguardam confirmação e os confirmados. */
export const columns: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'new', label: 'Novos', statuses: ['AWAITING_CONFIRMATION', 'NEW'] },
  { key: 'preparing', label: 'Em preparo', statuses: ['IN_PREPARATION'] },
  { key: 'ready', label: 'Prontos', statuses: ['READY'] },
  { key: 'delivered', label: 'Entregues', statuses: ['DELIVERED'] },
  { key: 'completed', label: 'Concluídos', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Cancelados', statuses: ['CANCELLED'] },
]

/** Próximo passo natural de cada etapa (mesmo fluxo validado pelo backend). */
export const nextStep: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  AWAITING_CONFIRMATION: { to: 'NEW', label: 'Confirmar' },
  NEW: { to: 'IN_PREPARATION', label: 'Iniciar preparo' },
  IN_PREPARATION: { to: 'READY', label: 'Marcar como pronto' },
  READY: { to: 'DELIVERED', label: 'Marcar como entregue' },
  DELIVERED: { to: 'COMPLETED', label: 'Concluir' },
}

/** Etapas que a cozinha executa sem a permissão de gerenciar pedidos. */
export const kitchenSteps: OrderStatus[] = ['NEW', 'IN_PREPARATION']

/** Destino ao soltar um card numa coluna: só aceita o próximo passo ou cancelamento. */
export function dropTarget(order: OrderView, columnKey: string): OrderStatus | null {
  const step = nextStep[order.status]
  const column = columns.find((c) => c.key === columnKey)
  if (!column) return null
  if (column.key === 'cancelled') return order.status === 'COMPLETED' || order.status === 'CANCELLED' ? null : 'CANCELLED'
  if (step && column.statuses.includes(step.to)) return step.to
  return null
}

export function canRun(permissions: string[], from: OrderStatus, to: OrderStatus) {
  if (permissions.includes('ORDERS_MANAGE')) return true
  return permissions.includes('KITCHEN_OPERATE') && kitchenSteps.includes(from) && nextStep[from]?.to === to
}

/** Minutos desde o recebimento (ou desde a confirmação, para a cozinha). */
export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
}

/** Limites de atraso usados nos alertas visuais (minutos). */
export const DELAY_WARNING = 15
export const DELAY_LATE = 25
