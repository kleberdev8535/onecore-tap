import { useParams } from 'react-router'
import { PlannedModulePage } from '@/features/admin/planned-module-page'
import { RESTAURANT_HOME, restaurantPlannedModules } from './navigation'
import { PlanLocked } from './plan-locked'

/** Módulos ainda não entregues ou bloqueados pelo plano do restaurante. */
export function RestaurantPlannedPage({ moduleKey }: { moduleKey?: string }) {
  const { key } = useParams()
  const item = restaurantPlannedModules.find((m) => m.key === (moduleKey ?? key))
  if (item?.path && item.module) return <PlanLocked item={item} />
  return <PlannedModulePage modules={restaurantPlannedModules.filter((m) => !m.path)} homePath={RESTAURANT_HOME} homeLabel="Voltar ao painel" moduleKey={moduleKey} />
}
