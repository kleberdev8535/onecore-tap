import { Navigate } from 'react-router'
import { useSession } from '@/features/auth/api'
import { RestaurantDashboardPage } from './dashboard-page'
import { can, firstAllowedPath } from './navigation'

/** /app: dashboard para quem tem acesso; os demais perfis vão para a primeira tela permitida. */
export function RestaurantIndex() {
  const { data: me } = useSession()
  if (!me) return null
  if (can(me, 'DASHBOARD_VIEW')) return <RestaurantDashboardPage />
  return <Navigate to={firstAllowedPath(me)} replace />
}
