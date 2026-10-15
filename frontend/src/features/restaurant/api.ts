import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sessionKey } from '@/features/auth/api'
import { http } from '@/services/http'
import type {
  AddonGroup,
  Category,
  InviteResult,
  OpeningHour,
  Product,
  RestaurantDashboard,
  RestaurantSettings,
  RestaurantTable,
  Role,
  SalesPeriod,
  StaffActivity,
  StaffMember,
} from '@/types/api'

/**
 * API do painel do restaurante. O backend resolve o restaurante pela sessão: nenhuma chamada envia restaurantId.
 * Toda mutação invalida o cache do painel para refletir o servidor.
 */
function useRestaurantMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, refreshSession = false) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      if (refreshSession) queryClient.invalidateQueries({ queryKey: sessionKey })
    },
  })
}

// ---------------------------------------------------------------- Dashboard

/** Trocar o período mantém o quadro anterior visível até chegar o novo (sem piscar). */
export const useRestaurantDashboard = (period: SalesPeriod = 'today') =>
  useQuery({
    queryKey: ['restaurant', 'dashboard', period],
    queryFn: () => http.get<RestaurantDashboard>(`/restaurant/dashboard?period=${period}`),
    placeholderData: keepPreviousData,
  })

// ---------------------------------------------------------------- Cardápio

export const useCategories = () =>
  useQuery({ queryKey: ['restaurant', 'categories'], queryFn: () => http.get<Category[]>('/restaurant/categories') })

export const useProducts = () =>
  useQuery({ queryKey: ['restaurant', 'products'], queryFn: () => http.get<Product[]>('/restaurant/products') })

export const useAddonGroups = (enabled = true) =>
  useQuery({
    queryKey: ['restaurant', 'addon-groups'],
    queryFn: () => http.get<AddonGroup[]>('/restaurant/addon-groups'),
    enabled,
  })

export interface CategoryInput {
  name: string
  description?: string
  active: boolean
}

export const useSaveCategory = () =>
  useRestaurantMutation(({ id, ...input }: CategoryInput & { id?: string }) =>
    id ? http.put<Category>(`/restaurant/categories/${id}`, input) : http.post<Category>('/restaurant/categories', input),
  )

export const useDeleteCategory = () => useRestaurantMutation((id: string) => http.del(`/restaurant/categories/${id}`))

export const useReorderCategories = () =>
  useRestaurantMutation((ids: string[]) => http.put<Category[]>('/restaurant/categories/order', { ids }))

export interface ProductInput {
  categoryId: string
  name: string
  description?: string
  priceCents: number
  imageUrl?: string
  active: boolean
  available: boolean
  featured: boolean
  addonGroupIds: string[]
}

export const useSaveProduct = () =>
  useRestaurantMutation(({ id, ...input }: ProductInput & { id?: string }) =>
    id ? http.put<Product>(`/restaurant/products/${id}`, input) : http.post<Product>('/restaurant/products', input),
  )

export const useProductAvailability = () =>
  useRestaurantMutation(({ id, available }: { id: string; available: boolean }) =>
    http.put<Product>(`/restaurant/products/${id}/availability`, { available }),
  )

export const useDeleteProduct = () => useRestaurantMutation((id: string) => http.del(`/restaurant/products/${id}`))

export const useReorderProducts = () =>
  useRestaurantMutation(({ categoryId, ids }: { categoryId: string; ids: string[] }) =>
    http.put<Product[]>(`/restaurant/products/order/${categoryId}`, { ids }),
  )

export interface AddonGroupInput {
  name: string
  minChoices: number
  maxChoices: number
  options: { id?: string; name: string; priceCents: number; available: boolean }[]
}

export const useSaveAddonGroup = () =>
  useRestaurantMutation(({ id, ...input }: AddonGroupInput & { id?: string }) =>
    id ? http.put<AddonGroup>(`/restaurant/addon-groups/${id}`, input) : http.post<AddonGroup>('/restaurant/addon-groups', input),
  )

export const useDeleteAddonGroup = () => useRestaurantMutation((id: string) => http.del(`/restaurant/addon-groups/${id}`))

// ---------------------------------------------------------------- Mesas

export const useTables = () =>
  useQuery({ queryKey: ['restaurant', 'tables'], queryFn: () => http.get<RestaurantTable[]>('/restaurant/tables') })

export const useCreateTables = () =>
  useRestaurantMutation((input: { labels?: string[]; from?: number; to?: number; capacity?: number }) =>
    http.post<RestaurantTable[]>('/restaurant/tables', input),
  )

export const useUpdateTable = () =>
  useRestaurantMutation(({ id, ...input }: { id: string; label: string; capacity: number | null; active: boolean }) =>
    http.put<RestaurantTable>(`/restaurant/tables/${id}`, input),
  )

// ---------------------------------------------------------------- Funcionários

export const useStaff = () =>
  useQuery({ queryKey: ['restaurant', 'staff'], queryFn: () => http.get<StaffMember[]>('/restaurant/staff') })

export const useStaffActivity = (id: string | null) =>
  useQuery({
    queryKey: ['restaurant', 'staff', id, 'activity'],
    queryFn: () => http.get<StaffActivity[]>(`/restaurant/staff/${id}/activity`),
    enabled: Boolean(id),
  })

export type StaffInviteResult = InviteResult & { user: StaffMember }

export const useInviteStaff = () =>
  useRestaurantMutation((input: { name: string; email: string; role: Role }) =>
    http.post<StaffInviteResult>('/restaurant/staff', input),
  )

export const useUpdateStaff = () =>
  useRestaurantMutation(({ id, ...input }: { id: string; name: string; role: Role }) =>
    http.put<StaffMember>(`/restaurant/staff/${id}`, input),
  )

export const useSetStaffActive = () =>
  useRestaurantMutation(({ id, active }: { id: string; active: boolean }) =>
    http.post<StaffMember>(`/restaurant/staff/${id}/${active ? 'activate' : 'deactivate'}`),
  )

export const useResendStaffInvite = () =>
  useRestaurantMutation((id: string) => http.post<StaffInviteResult>(`/restaurant/staff/${id}/invite`))

// ---------------------------------------------------------------- Personalização e configurações

export const useRestaurantSettings = () =>
  useQuery({ queryKey: ['restaurant', 'settings'], queryFn: () => http.get<RestaurantSettings>('/restaurant/settings') })

export interface ContactInput {
  email?: string
  phone?: string
  addressLine?: string
  city?: string
  state?: string
  postalCode?: string
  description?: string
}

export const useUpdateContact = () =>
  useRestaurantMutation((input: ContactInput) => http.put<RestaurantSettings>('/restaurant/settings/contact', input))

/** A marca aparece no cabeçalho do painel (sessão), por isso a sessão também é recarregada. */
export const useUpdateRestaurantBranding = () =>
  useRestaurantMutation(
    (input: { logoUrl?: string; coverImageUrl?: string; primaryColor: string; accentColor: string }) =>
      http.put<RestaurantSettings>('/restaurant/settings/branding', input),
    true,
  )

export const useUpdateHours = () =>
  useRestaurantMutation((hours: OpeningHour[]) => http.put<RestaurantSettings>('/restaurant/settings/hours', { hours }))

export const useUpdateOperation = () =>
  useRestaurantMutation((requireOrderConfirmation: boolean) =>
    http.put<RestaurantSettings>('/restaurant/settings/operation', { requireOrderConfirmation }),
  )
