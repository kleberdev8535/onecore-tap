import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/services/http'
import type {
  AdminUser,
  AuditEntry,
  InventoryCounts,
  InviteResult,
  Onboarding,
  PageResponse,
  Plan,
  PlateAction,
  PlateBatch,
  PlateDetail,
  PlateStatus,
  PlateView,
  PlatformSettings,
  RestaurantDetail,
  Role,
  TableView,
} from '@/types/api'

/** Qualquer mutacao administrativa invalida o cache do painel: dados sempre refletem o servidor. */
function useAdminMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  })
  return search.toString()
}

// ---------------------------------------------------------------- Implantacao

export function useOnboarding(id: string) {
  return useQuery({
    queryKey: ['admin', 'restaurant', id, 'onboarding'],
    queryFn: () => http.get<Onboarding>(`/admin/restaurants/${id}/onboarding`),
  })
}

export function useRestaurantTables(id: string) {
  return useQuery({
    queryKey: ['admin', 'restaurant', id, 'tables'],
    queryFn: () => http.get<TableView[]>(`/admin/restaurants/${id}/tables`),
    enabled: Boolean(id),
  })
}

export interface DetailsInput {
  tradeName: string
  legalName?: string
  cnpj?: string
  email?: string
  phone?: string
  addressLine?: string
  city?: string
  state?: string
  postalCode?: string
}

export const useUpdateDetails = (id: string) =>
  useAdminMutation((input: DetailsInput) => http.put<RestaurantDetail>(`/admin/restaurants/${id}/details`, input))

export const useUpdateBranding = (id: string) =>
  useAdminMutation((input: { logoUrl?: string; primaryColor: string; accentColor: string }) =>
    http.put<RestaurantDetail>(`/admin/restaurants/${id}/branding`, input),
  )

export const useAssignPlan = (id: string) =>
  useAdminMutation((planId: string) => http.put<Onboarding>(`/admin/restaurants/${id}/plan`, { planId }))

export const useInviteOwner = (id: string) =>
  useAdminMutation((input: { name: string; email: string }) =>
    http.post<InviteResult & { userId: string; name: string; email: string }>(`/admin/restaurants/${id}/owner`, input),
  )

export const useCreateTables = (id: string) =>
  useAdminMutation((input: { labels?: string[]; from?: number; to?: number; capacity?: number }) =>
    http.post<TableView[]>(`/admin/restaurants/${id}/tables`, input),
  )

export type RestaurantStatusAction = 'ACTIVATE' | 'START_TRIAL' | 'SUSPEND' | 'CANCEL'

export const useChangeRestaurantStatus = (id: string) =>
  useAdminMutation((input: { action: RestaurantStatusAction; reason?: string }) =>
    http.post<RestaurantDetail>(`/admin/restaurants/${id}/status`, input),
  )

// ---------------------------------------------------------------- Planos

export function usePlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: () => http.get<Plan[]>('/admin/plans') })
}

export interface PlanInput {
  code?: string
  name: string
  description?: string
  monthlyPriceCents: number
  maxTables?: number | null
  maxUsers?: number | null
  trialDays: number
  features: string[]
  modules: string[]
  active: boolean
}

export const useSavePlan = () =>
  useAdminMutation(({ id, ...input }: PlanInput & { id?: string }) =>
    id ? http.put<Plan>(`/admin/plans/${id}`, input) : http.post<Plan>('/admin/plans', input),
  )

// ---------------------------------------------------------------- Plaquinhas

export interface PlateQuery {
  search: string
  status: PlateStatus | ''
  batchId?: string
  restaurantId?: string
  page: number
}

export function usePlates(query: PlateQuery) {
  return useQuery({
    queryKey: ['admin', 'plates', query],
    queryFn: () => http.get<PageResponse<PlateView>>(`/admin/plates?${qs({ ...query, size: 25 })}`),
    placeholderData: keepPreviousData,
  })
}

export function usePlateCounts() {
  return useQuery({ queryKey: ['admin', 'plates', 'counts'], queryFn: () => http.get<InventoryCounts>('/admin/plates/counts') })
}

export function usePlateDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'plates', 'detail', id],
    queryFn: () => http.get<PlateDetail>(`/admin/plates/${id}`),
    enabled: Boolean(id),
  })
}

export const useChangePlate = () =>
  useAdminMutation(
    ({ id, ...input }: { id: string; action: PlateAction; restaurantId?: string; tableId?: string; reason?: string }) =>
      http.post<PlateDetail>(`/admin/plates/${id}/changes`, input),
  )

export function useBatches() {
  return useQuery({ queryKey: ['admin', 'batches'], queryFn: () => http.get<PlateBatch[]>('/admin/plate-batches') })
}

export const useCreateBatch = () =>
  useAdminMutation((input: { code?: string; manufacturedOn?: string; quantity: number; notes?: string }) =>
    http.post<PlateBatch>('/admin/plate-batches', input),
  )

// ---------------------------------------------------------------- Usuarios, auditoria, configuracoes

export interface UserQuery {
  search: string
  role: Role | ''
  active: '' | 'true' | 'false'
  page: number
}

export function useAdminUsers(query: UserQuery) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => http.get<PageResponse<AdminUser>>(`/admin/users?${qs({ ...query })}`),
    placeholderData: keepPreviousData,
  })
}

export const useSetUserActive = () =>
  useAdminMutation(({ id, active }: { id: string; active: boolean }) =>
    http.post<AdminUser>(`/admin/users/${id}/${active ? 'activate' : 'deactivate'}`),
  )

export const useResendInvite = () =>
  useAdminMutation((id: string) => http.post<InviteResult & { user: AdminUser }>(`/admin/users/${id}/invite`))

export interface AuditQuery {
  action: string
  actor: string
  from: string
  to: string
  page: number
}

export function useAudit(query: AuditQuery) {
  return useQuery({
    queryKey: ['admin', 'audit', query],
    queryFn: () => http.get<PageResponse<AuditEntry>>(`/admin/audit?${qs({ ...query })}`),
    placeholderData: keepPreviousData,
  })
}

export function useSettings() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => http.get<PlatformSettings>('/admin/settings') })
}

export const useSaveSettings = () =>
  useAdminMutation((input: { platePriceCents: number; billingGraceDays?: number }) => http.put<PlatformSettings>('/admin/settings', input))
