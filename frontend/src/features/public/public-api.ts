import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, http } from '@/services/http'
import type { PublicMenu, PublicOrder, PublicSession, ServiceRequestType } from '@/types/api'

const noRetryOn4xx = (count: number, error: unknown) => !(error instanceof ApiError && error.status < 500) && count < 2

/** Identificador anônimo deste aparelho, para listar "meus pedidos" na mesa. Não identifica a pessoa. */
export function clientToken(): string {
  const KEY = 'onecore.client'
  try {
    const existing = localStorage.getItem(KEY)
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem(KEY, token)
    return token
  } catch {
    return 'sem-armazenamento-' + Math.random().toString(36).slice(2, 12)
  }
}

export const useMenu = (token: string) =>
  useQuery({
    queryKey: ['public', 'menu', token],
    queryFn: () => http.get<PublicMenu>(`/public/plates/${encodeURIComponent(token)}/menu`),
    retry: noRetryOn4xx,
    staleTime: 60_000,
  })

export const useTableSession = (token: string, enabled = true) =>
  useQuery({
    queryKey: ['public', 'session', token],
    queryFn: () => http.get<PublicSession>(`/public/plates/${encodeURIComponent(token)}/session?client=${clientToken()}`),
    retry: noRetryOn4xx,
    refetchInterval: 15_000,
    enabled,
  })

const FINAL = new Set(['COMPLETED', 'CANCELLED'])

/** Acompanhamento do pedido: consulta a cada 5 s até o pedido ser concluído ou cancelado. */
export const useTrackOrder = (tracking: string) =>
  useQuery({
    queryKey: ['public', 'order', tracking],
    queryFn: () => http.get<PublicOrder>(`/public/orders/${encodeURIComponent(tracking)}`),
    retry: noRetryOn4xx,
    refetchInterval: (q) => (q.state.data && FINAL.has(q.state.data.status) ? false : 5_000),
  })

export interface PlaceOrderInput {
  customerName?: string
  notes?: string
  items: { productId: string; quantity: number; notes?: string; optionIds: string[] }[]
}

export function usePlaceOrder(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaceOrderInput) =>
      http.post<PublicOrder>(`/public/plates/${encodeURIComponent(token)}/orders`, { ...input, clientToken: clientToken() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public', 'session', token] }),
  })
}

export function useServiceRequest(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (type: ServiceRequestType) => http.post(`/public/plates/${encodeURIComponent(token)}/requests`, { type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public', 'session', token] }),
  })
}
