import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/services/http'
import type { OrderBoard, OrderEventView, OrderStatus, OrderView, PageResponse } from '@/types/api'

export const boardKey = ['restaurant', 'orders', 'board'] as const

/**
 * Quadro de pedidos. Atualizado pelos eventos em tempo real; o intervalo longo é só uma rede de segurança caso a
 * conexão em tempo real caia sem ser percebida.
 */
export const useOrderBoard = () =>
  useQuery({
    queryKey: boardKey,
    queryFn: () => http.get<OrderBoard>('/restaurant/orders/board'),
    refetchInterval: 60_000,
    staleTime: 5_000,
  })

export const useOrderDetail = (id: string | null) =>
  useQuery({
    queryKey: ['restaurant', 'orders', 'detail', id],
    queryFn: () => http.get<{ order: OrderView; history: OrderEventView[] }>(`/restaurant/orders/${id}`),
    enabled: Boolean(id),
  })

export interface HistoryQuery {
  status: OrderStatus | ''
  search: string
  from: string
  to: string
  page: number
}

export const useOrderHistory = (q: HistoryQuery, enabled: boolean) =>
  useQuery({
    queryKey: ['restaurant', 'orders', 'history', q],
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(q).forEach(([k, v]) => {
        if (v !== '' && v !== undefined) params.set(k, String(v))
      })
      return http.get<PageResponse<OrderView>>(`/restaurant/orders?${params}`)
    },
    placeholderData: keepPreviousData,
    enabled,
  })

/** Atualiza o quadro na hora (resposta do servidor) e recarrega o resto do painel em seguida. */
export function useTransition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, from, to, reason }: { id: string; from: OrderStatus; to: OrderStatus; reason?: string }) =>
      http.post<OrderView>(`/restaurant/orders/${id}/transition`, { from, to, reason }),
    onSuccess: (updated) => {
      queryClient.setQueryData<OrderBoard>(boardKey, (board) =>
        board ? { ...board, orders: board.orders.map((o) => (o.id === updated.id ? updated : o)) } : board,
      )
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
    },
    // Conflito (outra pessoa já moveu): recarrega para mostrar o estado real.
    onError: () => queryClient.invalidateQueries({ queryKey: boardKey }),
  })
}

export function useResolveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.post<void>(`/restaurant/orders/requests/${id}/resolve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant'] }),
  })
}

export function useCloseTable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tableId: string) => http.post(`/restaurant/tables/${tableId}/close`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant'] }),
  })
}
