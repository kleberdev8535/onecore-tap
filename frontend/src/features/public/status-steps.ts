import type { OrderStatus } from '@/types/api'

/** Etapas do pedido em linguagem do cliente. */
export const customerSteps: { status: OrderStatus; label: string; hint: string }[] = [
  { status: 'AWAITING_CONFIRMATION', label: 'Enviado', hint: 'Aguardando o restaurante confirmar' },
  { status: 'NEW', label: 'Confirmado', hint: 'Seu pedido está na fila da cozinha' },
  { status: 'IN_PREPARATION', label: 'Em preparo', hint: 'A cozinha está preparando' },
  { status: 'READY', label: 'Pronto', hint: 'Já vai para a sua mesa' },
  { status: 'DELIVERED', label: 'Entregue', hint: 'Bom apetite' },
]

export function customerStatus(status: OrderStatus) {
  if (status === 'CANCELLED') return { label: 'Cancelado', hint: 'Fale com um atendente para mais informações' }
  if (status === 'COMPLETED') return { label: 'Concluído', hint: 'Obrigado pela visita' }
  return customerSteps.find((s) => s.status === status) ?? customerSteps[0]
}

/** Índice da etapa atual (concluído conta como entregue). */
export function stepIndex(status: OrderStatus) {
  if (status === 'COMPLETED') return customerSteps.length - 1
  return customerSteps.findIndex((s) => s.status === status)
}
