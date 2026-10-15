import type { BadgeProps } from '@/components/ui/badge'
import type { RestaurantStatus } from '@/types/api'

export const restaurantStatusMeta: Record<RestaurantStatus, { label: string; tone: BadgeProps['tone'] }> = {
  ONBOARDING: { label: 'Em implantação', tone: 'info' },
  TRIAL: { label: 'Em teste', tone: 'warning' },
  ACTIVE: { label: 'Ativo', tone: 'success' },
  SUSPENDED: { label: 'Suspenso', tone: 'danger' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
}
