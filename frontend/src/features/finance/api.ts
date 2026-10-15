import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/services/http'
import type { OrderStatus, PageResponse } from '@/types/api'

export type PaymentMethod = 'PIX' | 'CASH' | 'CARD'

export const paymentMethodLabels: Record<PaymentMethod, string> = { PIX: 'Pix', CASH: 'Dinheiro', CARD: 'Cartão' }

export interface PaymentEntry {
  method: PaymentMethod
  amountCents: number
  receivedCents: number | null
  changeCents: number
}

export interface Payment {
  id: string
  scope: 'ORDER' | 'TABLE'
  tableLabel: string | null
  totalCents: number
  entries: PaymentEntry[]
  orderNumbers: number[]
  registeredBy: string
  notes: string | null
  createdAt: string
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
}

export interface PendingOrder {
  id: string
  number: number
  status: OrderStatus
  totalCents: number
  createdAt: string
  currentAttendance: boolean
}

export interface PendingTable {
  tableId: string
  tableLabel: string
  attendanceOpen: boolean
  totalCents: number
  orders: PendingOrder[]
}

export interface FinanceTotals {
  soldCents: number
  orders: number
  averageTicketCents: number
  paidCents: number
  paidOrders: number
  pendingCents: number
  pendingOrders: number
  cancelledOrders: number
  cancelledCents: number
}

export interface FinanceRow {
  name: string
  quantity: number
  totalCents: number
}

export interface FinanceSummary {
  from: string
  to: string
  previousFrom: string
  previousTo: string
  current: FinanceTotals
  previous: FinanceTotals
  byMethod: { method: PaymentMethod; label: string; payments: number; totalCents: number }[]
  byProduct: FinanceRow[]
  byCategory: FinanceRow[]
  byTable: FinanceRow[]
  daily: { day: string; soldCents: number; paidCents: number; orders: number }[]
  testOrdersExcluded: number
  voidedPayments: number
}

export interface RegisterPaymentInput {
  scope: 'ORDER' | 'TABLE'
  orderIds?: string[]
  tableId?: string
  entries: { method: PaymentMethod; amountCents: number; receivedCents?: number }[]
  notes?: string
}

/** Pagamento muda pedidos, mesas e indicadores: atualiza todo o painel do restaurante. */
function useFinanceMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant'] }) })
}

export const useRegisterPayment = () =>
  useFinanceMutation((input: RegisterPaymentInput) => http.post<Payment>('/restaurant/payments', input))

export const useVoidPayment = () =>
  useFinanceMutation(({ id, reason }: { id: string; reason: string }) => http.post<Payment>(`/restaurant/payments/${id}/void`, { reason }))

export const usePendingPayments = (enabled = true) =>
  useQuery({
    queryKey: ['restaurant', 'payments', 'pending'],
    queryFn: () => http.get<PendingTable[]>('/restaurant/payments/pending'),
    enabled,
  })

export const usePayments = (from: string, to: string, page: number) =>
  useQuery({
    queryKey: ['restaurant', 'payments', from, to, page],
    queryFn: () => http.get<PageResponse<Payment>>(`/restaurant/payments?from=${from}&to=${to}&page=${page}`),
    placeholderData: keepPreviousData,
  })

export const useFinanceSummary = (from: string, to: string) =>
  useQuery({
    queryKey: ['restaurant', 'finance', from, to],
    queryFn: () => http.get<FinanceSummary>(`/restaurant/finance/summary?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  })

export const useReportSummary = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ['restaurant', 'reports', from, to],
    queryFn: () => http.get<FinanceSummary>(`/restaurant/reports/summary?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
    enabled,
  })
