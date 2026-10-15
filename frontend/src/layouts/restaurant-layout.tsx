import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/features/auth/api'
import { restaurantStatusMeta } from '@/features/admin/restaurant-status-meta'
import { useRealtime } from '@/features/orders/realtime'
import { can, firstAllowedPath, navigationFor, RESTAURANT_HOME, RESTAURANT_MODULES } from '@/features/restaurant/navigation'
import { AppShell } from './app-shell'

export function RestaurantLayout() {
  const { data: me } = useSession()
  // Um único canal em tempo real para todo o painel (pedidos, cozinha, mesas e dashboard).
  useRealtime(Boolean(me && can(me, 'ORDERS_VIEW')))
  if (!me) return null
  const restaurant = me.restaurant

  const context = restaurant && (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
      <span
        className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-semibold text-white"
        style={{ backgroundColor: restaurant.primaryColor }}
        aria-hidden
      >
        {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" className="size-full object-cover" /> : restaurant.tradeName.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">{restaurant.tradeName}</span>
        {restaurant.status !== 'ACTIVE' && (
          <Badge tone="neutral" className="mt-1 bg-white/10 text-white/70 ring-white/10">
            {restaurantStatusMeta[restaurant.status].label}
          </Badge>
        )}
      </span>
    </div>
  )

  return <AppShell groups={navigationFor(me)} homePath={RESTAURANT_HOME} modulesBase={RESTAURANT_MODULES} context={context} />
}

/** Proteção de tela por permissão no cliente. A autorização real é sempre do backend. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { data: me } = useSession()
  if (!me) return null
  if (!can(me, permission)) return <Navigate to={firstAllowedPath(me)} replace />
  return <>{children}</>
}
