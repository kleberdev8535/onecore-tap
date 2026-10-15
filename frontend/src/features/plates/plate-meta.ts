import type { BadgeProps } from '@/components/ui/badge'
import type { PlateEventType, PlateStatus } from '@/types/api'

export const plateStatusMeta: Record<PlateStatus, { label: string; tone: BadgeProps['tone'] }> = {
  AVAILABLE: { label: 'Disponível', tone: 'neutral' },
  RESERVED: { label: 'Reservada', tone: 'info' },
  ACTIVE: { label: 'Ativa', tone: 'success' },
  SUSPENDED: { label: 'Suspensa', tone: 'warning' },
  DAMAGED: { label: 'Danificada', tone: 'danger' },
  DEACTIVATED: { label: 'Desativada', tone: 'dark' },
}

export const plateEventLabels: Record<PlateEventType, string> = {
  CREATED: 'Cadastrada no estoque',
  RESERVED: 'Reservada para restaurante',
  ASSIGNED: 'Vinculada à mesa',
  TRANSFERRED: 'Transferida',
  RELEASED: 'Desvinculada',
  SUSPENDED: 'Suspensa',
  REACTIVATED: 'Reativada',
  DAMAGED: 'Marcada como danificada',
  RESTORED: 'Devolvida ao estoque',
  DEACTIVATED: 'Desativada',
}
