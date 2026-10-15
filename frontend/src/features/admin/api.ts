import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/services/http'
import type { AdminOverview, PageResponse, RestaurantDetail, RestaurantListItem, RestaurantStatus } from '@/types/api'

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  restaurants: (params: RestaurantQuery) => ['admin', 'restaurants', params] as const,
  restaurant: (id: string) => ['admin', 'restaurant', id] as const,
}

export function useAdminOverview() {
  return useQuery({ queryKey: adminKeys.overview, queryFn: () => http.get<AdminOverview>('/admin/overview') })
}

export interface RestaurantQuery {
  search: string
  status: RestaurantStatus | ''
  page: number
  size?: number
}

export function useRestaurants(query: RestaurantQuery) {
  return useQuery({
    queryKey: adminKeys.restaurants(query),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(query.page), size: String(query.size ?? 20) })
      if (query.search.trim()) params.set('search', query.search.trim())
      if (query.status) params.set('status', query.status)
      return http.get<PageResponse<RestaurantListItem>>(`/admin/restaurants?${params}`)
    },
    placeholderData: keepPreviousData,
  })
}

export function useRestaurant(id: string) {
  return useQuery({ queryKey: adminKeys.restaurant(id), queryFn: () => http.get<RestaurantDetail>(`/admin/restaurants/${id}`) })
}

export interface CreateRestaurantInput {
  tradeName: string
  slug?: string
  legalName?: string
  cnpj?: string
  email?: string
  phone?: string
  city?: string
  state?: string
}

export function useCreateRestaurant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateRestaurantInput) => http.post<RestaurantDetail>('/admin/restaurants', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}
