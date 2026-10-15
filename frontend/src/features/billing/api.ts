import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/services/http'

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED'
export type ReceiptMethod = 'PIX' | 'BOLETO' | 'CARD' | 'TRANSFER' | 'CASH' | 'OTHER'
export type ChargeStatus = 'OPEN' | 'PAID' | 'VOID'

export const receiptMethodLabels: Record<ReceiptMethod, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CARD: 'Cartão',
  TRANSFER: 'Transferência',
  CASH: 'Dinheiro',
  OTHER: 'Outro',
}

export interface Subscription {
  id: string
  restaurantId: string
  restaurantName: string
  restaurantStatus: string | null
  suspendedByBilling: boolean
  planId: string
  planName: string
  status: SubscriptionStatus
  statusLabel: string
  priceCents: number
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  openCents: number
  overdueCents: number
  nextDueDate: string | null
  provider: string | null
}

export interface Invoice {
  id: string
  planName: string
  periodStart: string
  periodEnd: string
  amountCents: number
  dueDate: string
  status: ChargeStatus
  overdue: boolean
  paidAt: string | null
  paymentMethod: ReceiptMethod | null
  registeredBy: string | null
  notes: string | null
  voidReason: string | null
}

export interface PlateSale {
  id: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  status: ChargeStatus
  paidAt: string | null
  paymentMethod: ReceiptMethod | null
  notes: string | null
  registeredBy: string
  voidReason: string | null
  createdAt: string
}

export interface BillingDetail {
  subscription: Subscription | null
  invoices: Invoice[]
  plateSales: PlateSale[]
  graceDays: number
}

export interface PlatformFinance {
  from: string
  to: string
  mrrCents: number
  payingSubscriptions: number
  trialing: number
  pastDue: number
  suspended: number
  receivedSubscriptionsCents: number
  receivedPlatesCents: number
  openInvoicesCents: number
  overdueCents: number
  overdueRestaurants: number
  platesReceivableCents: number
  platesSold: number
  newSubscriptions: number
  cancellations: number
  delinquencyRate: number
  platePriceCents: number
  months: { month: string; subscriptionsCents: number; platesCents: number }[]
}

export interface CycleResult {
  day: string
  trialsConverted: number
  invoicesIssued: number
  markedPastDue: number
  suspended: number
}

function useBillingMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }) })
}

export const useSubscriptions = () =>
  useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: () => http.get<Subscription[]>('/admin/subscriptions') })

/** 204 (sem assinatura nem vendas) vira null. */
export const useBillingDetail = (restaurantId: string) =>
  useQuery({
    queryKey: ['admin', 'restaurant', restaurantId, 'billing'],
    queryFn: async () => (await http.get<BillingDetail | undefined>(`/admin/restaurants/${restaurantId}/billing`)) ?? null,
  })

export const usePlatformFinance = (from: string, to: string) =>
  useQuery({ queryKey: ['admin', 'finance', from, to], queryFn: () => http.get<PlatformFinance>(`/admin/finance?from=${from}&to=${to}`) })

export const usePayInvoice = () =>
  useBillingMutation(({ id, ...body }: { id: string; method: ReceiptMethod; paidOn?: string; notes?: string }) =>
    http.post<Invoice>(`/admin/invoices/${id}/pay`, body),
  )

export const useVoidInvoice = () =>
  useBillingMutation(({ id, reason }: { id: string; reason: string }) => http.post<Invoice>(`/admin/invoices/${id}/void`, { reason }))

export const useRegisterPlateSale = (restaurantId: string) =>
  useBillingMutation((body: { quantity: number; notes?: string }) => http.post<PlateSale>(`/admin/restaurants/${restaurantId}/plate-sales`, body))

export const usePayPlateSale = () =>
  useBillingMutation(({ id, method }: { id: string; method: ReceiptMethod }) => http.post<PlateSale>(`/admin/plate-sales/${id}/pay`, { method }))

export const useVoidPlateSale = () =>
  useBillingMutation(({ id, reason }: { id: string; reason: string }) => http.post<PlateSale>(`/admin/plate-sales/${id}/void`, { reason }))

export const useRunBillingCycle = () => useBillingMutation(() => http.post<CycleResult>('/admin/billing/run'))
