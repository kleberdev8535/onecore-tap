import type { BadgeProps } from '@/components/ui/badge'
import type { ChargeStatus, SubscriptionStatus } from './api'

export const subscriptionMeta: Record<SubscriptionStatus, { label: string; tone: BadgeProps['tone'] }> = {
  TRIALING: { label: 'Em teste', tone: 'info' },
  ACTIVE: { label: 'Em dia', tone: 'success' },
  PAST_DUE: { label: 'Em atraso', tone: 'warning' },
  SUSPENDED: { label: 'Suspensa', tone: 'danger' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
}

export const chargeMeta: Record<ChargeStatus, { label: string; tone: BadgeProps['tone'] }> = {
  OPEN: { label: 'Em aberto', tone: 'neutral' },
  PAID: { label: 'Recebida', tone: 'success' },
  VOID: { label: 'Anulada', tone: 'neutral' },
}

export const formatIsoDay = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
