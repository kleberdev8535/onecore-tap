import { Badge } from '@/components/ui/badge'
import type { RestaurantStatus } from '@/types/api'
import { restaurantStatusMeta } from './restaurant-status-meta'

export function RestaurantStatusBadge({ status }: { status: RestaurantStatus }) {
  const meta = restaurantStatusMeta[status]
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}
