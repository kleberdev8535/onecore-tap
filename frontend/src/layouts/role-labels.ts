import type { Role } from '@/types/api'

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  RESTAURANT_OWNER: 'Proprietário',
  RESTAURANT_MANAGER: 'Gerente',
  CASHIER: 'Caixa',
  WAITER: 'Garçom',
  KITCHEN: 'Cozinha',
}
