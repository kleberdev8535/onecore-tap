export type Role =
  | 'SUPER_ADMIN'
  | 'RESTAURANT_OWNER'
  | 'RESTAURANT_MANAGER'
  | 'CASHIER'
  | 'WAITER'
  | 'KITCHEN'

export type RestaurantStatus = 'ONBOARDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'

export interface RestaurantSummary {
  id: string
  tradeName: string
  slug: string
  status: RestaurantStatus
  logoUrl: string | null
  primaryColor: string
}

export interface Me {
  id: string
  name: string
  email: string
  role: Role
  permissions: string[]
  restaurant: RestaurantSummary | null
  /** Módulos opcionais liberados pelo plano (KITCHEN, FINANCE, REPORTS). */
  modules: string[]
}

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface RestaurantListItem {
  id: string
  tradeName: string
  slug: string
  city: string | null
  state: string | null
  status: RestaurantStatus
  createdAt: string
}

export interface RestaurantDetail extends RestaurantListItem {
  legalName: string | null
  cnpj: string | null
  email: string | null
  phone: string | null
  addressLine: string | null
  postalCode: string | null
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  userCount: number
}

export interface AdminOverview {
  restaurants: {
    total: number
    onboarding: number
    trial: number
    active: number
    suspended: number
    cancelled: number
    createdThisMonth: number
  }
  restaurantUsers: number
  plates: InventoryCounts
  generatedAt: string
}

// ---------------------------------------------------------------- Fase 2

export interface InventoryCounts {
  available: number
  reserved: number
  active: number
  suspended: number
  damaged: number
  deactivated: number
}

export interface Ref {
  id: string
  name: string
}

export type PlateStatus = 'AVAILABLE' | 'RESERVED' | 'ACTIVE' | 'SUSPENDED' | 'DAMAGED' | 'DEACTIVATED'
export type PlateAction = 'BIND' | 'RELEASE' | 'SUSPEND' | 'REACTIVATE' | 'DAMAGE' | 'RESTORE' | 'DEACTIVATE'
export type PlateEventType =
  | 'CREATED'
  | 'RESERVED'
  | 'ASSIGNED'
  | 'TRANSFERRED'
  | 'RELEASED'
  | 'SUSPENDED'
  | 'REACTIVATED'
  | 'DAMAGED'
  | 'RESTORED'
  | 'DEACTIVATED'

export interface PlateView {
  id: string
  serial: string
  publicToken: string
  publicUrl: string
  status: PlateStatus
  batch: Ref | null
  restaurant: Ref | null
  table: Ref | null
  activatedAt: string | null
  updatedAt: string
}

export interface PlateEventView {
  id: string
  event: PlateEventType
  fromStatus: PlateStatus | null
  toStatus: PlateStatus
  restaurant: Ref | null
  table: Ref | null
  actorEmail: string | null
  reason: string | null
  createdAt: string
}

export interface PlateDetail {
  plate: PlateView
  history: PlateEventView[]
}

export interface PlateBatch {
  id: string
  code: string
  manufacturedOn: string | null
  quantity: number
  notes: string | null
  createdAt: string
  available: number
  inUse: number
}

export interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  monthlyPriceCents: number
  maxTables: number | null
  maxUsers: number | null
  trialDays: number
  features: string[]
  /** Módulos opcionais liberados (KITCHEN, FINANCE, REPORTS). */
  modules: string[]
  active: boolean
  restaurantCount: number
}

export interface TableView {
  id: string
  label: string
  capacity: number | null
  active: boolean
}

export interface OnboardingStep {
  key: string
  label: string
  done: boolean
  available: boolean
  detail: string | null
}

export interface Onboarding {
  steps: OnboardingStep[]
  done: number
  total: number
  readyToActivate: boolean
  missing: string[]
  plan: { id: string; name: string; monthlyPriceCents: number; maxTables: number | null; trialDays: number } | null
  owner: { id: string; name: string; email: string; active: boolean; lastLoginAt: string | null } | null
  tableCount: number
  activePlateCount: number
  categoryCount: number
  productCount: number
  trialEndsAt: string | null
  activatedAt: string | null
  statusReason: string | null
}

export interface InviteResult {
  inviteLink: string
  expiresAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  restaurantId: string | null
  restaurantName: string | null
  lastLoginAt: string | null
  createdAt: string
}

export interface AuditEntry {
  id: string
  action: string
  actorEmail: string | null
  restaurantId: string | null
  restaurantName: string | null
  entityType: string | null
  entityId: string | null
  ipAddress: string | null
  details: string | null
  createdAt: string
}

export interface PlatformSettings {
  platePriceCents: number
  plateBaseUrl: string
  billingGraceDays: number
}

export interface PublicPlate {
  token: string
  tableLabel: string
  preview: boolean
  restaurant: { tradeName: string; slug: string; logoUrl: string | null; primaryColor: string; accentColor: string }
}

// ---------------------------------------------------------------- Fase 3: painel do restaurante

export interface Category {
  id: string
  name: string
  description: string | null
  position: number
  active: boolean
  productCount: number
}

export interface Product {
  id: string
  categoryId: string
  name: string
  description: string | null
  priceCents: number
  imageUrl: string | null
  active: boolean
  available: boolean
  featured: boolean
  position: number
  addonGroupIds: string[]
}

export interface AddonOption {
  id: string
  name: string
  priceCents: number
  available: boolean
}

export interface AddonGroup {
  id: string
  name: string
  minChoices: number
  maxChoices: number
  position: number
  options: AddonOption[]
  productCount: number
}

export type TableState = 'FREE' | 'OCCUPIED' | 'AWAITING_SERVICE' | 'AWAITING_BILL' | 'UNAVAILABLE'

export interface RestaurantTable {
  id: string
  label: string
  capacity: number | null
  active: boolean
  plate: { serial: string; status: PlateStatus; publicUrl: string } | null
  state: TableState
  openedAt: string | null
  openTotalCents: number
  openOrders: number
  activeOrders: number
}

export interface StaffMember {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  pendingInvite: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface StaffActivity {
  id: string
  action: string
  actorEmail: string | null
  details: string | null
  createdAt: string
}

export interface OpeningHour {
  /** 1 = segunda ... 7 = domingo */
  weekday: number
  /** HH:mm ou HH:mm:ss */
  opensAt: string
  closesAt: string
}

export interface RestaurantSettings {
  id: string
  tradeName: string
  legalName: string | null
  cnpj: string | null
  slug: string
  status: RestaurantStatus
  email: string | null
  phone: string | null
  addressLine: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  description: string | null
  logoUrl: string | null
  coverImageUrl: string | null
  primaryColor: string
  accentColor: string
  requireOrderConfirmation: boolean
  openingHours: OpeningHour[]
  plan: { name: string; maxTables: number | null; maxUsers: number | null } | null
}

export interface RestaurantDashboard {
  tradeName: string
  status: RestaurantStatus
  trialEndsAt: string | null
  plan: { name: string; maxTables: number | null; maxUsers: number | null } | null
  menu: {
    categories: number
    activeCategories: number
    products: number
    activeProducts: number
    unavailableProducts: number
    featuredProducts: number
    productsWithoutImage: number
    addonGroups: number
    emptyCategories: string[]
  }
  tables: { total: number; active: number; withPlate: number }
  staff: { total: number; active: number; pendingInvites: number }
  setup: { key: string; label: string; done: boolean; hint: string }[]
  ordersModuleAvailable: boolean
  sales: SalesSummary
  generatedAt: string
}

export type SalesPeriod = 'today' | '7d' | '30d'

export interface PeriodTotals {
  revenueCents: number
  orders: number
  averageTicketCents: number
  cancelled: number
}

export interface SalesSummary {
  period: SalesPeriod
  from: string
  to: string
  current: PeriodTotals
  previous: PeriodTotals
  live: { awaitingConfirmation: number; newOrders: number; inPreparation: number; ready: number; occupiedTables: number; openRequests: number }
  topProducts: { name: string; quantity: number; revenueCents: number }[]
  daily: { day: string; revenueCents: number; orders: number }[]
  hourly: { hour: number; orders: number }[]
  testOrders: number
}

// ---------------------------------------------------------------- Fase 4: pedidos

export type OrderStatus = 'AWAITING_CONFIRMATION' | 'NEW' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
export type ServiceRequestType = 'CALL_WAITER' | 'REQUEST_BILL'

export interface OrderItemView {
  productName: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  notes: string | null
  options: { groupName: string; optionName: string; priceCents: number }[]
}

export interface OrderView {
  id: string
  number: number
  tableId: string
  tableLabel: string
  status: OrderStatus
  paymentStatus: 'UNPAID' | 'PAID'
  customerName: string | null
  notes: string | null
  totalCents: number
  test: boolean
  createdAt: string
  confirmedAt: string | null
  preparingAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: OrderItemView[]
}

export interface OrderEventView {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorName: string | null
  reason: string | null
  createdAt: string
}

export interface ServiceRequestView {
  id: string
  tableId: string
  tableLabel: string
  type: ServiceRequestType
  createdAt: string
}

export interface OrderBoard {
  orders: OrderView[]
  requests: ServiceRequestView[]
  generatedAt: string
}

export interface PublicOrder {
  trackingToken: string
  number: number
  tableLabel: string
  status: OrderStatus
  statusLabel: string
  totalCents: number
  test: boolean
  createdAt: string
  updatedAt: string
  items: OrderItemView[]
}

export interface PublicSession {
  tableLabel: string
  open: boolean
  openedAt: string | null
  tableTotalCents: number
  tableOrders: number
  myOrders: PublicOrder[]
  openRequests: ServiceRequestType[]
}

export interface PublicMenuOption {
  id: string
  name: string
  priceCents: number
  available: boolean
}

export interface PublicMenuGroup {
  id: string
  name: string
  minChoices: number
  maxChoices: number
  options: PublicMenuOption[]
}

export interface PublicMenuProduct {
  id: string
  name: string
  description: string | null
  priceCents: number
  imageUrl: string | null
  available: boolean
  featured: boolean
  addonGroupIds: string[]
}

export interface PublicMenu {
  token: string
  tableLabel: string
  preview: boolean
  openNow: boolean
  requireOrderConfirmation: boolean
  restaurant: {
    tradeName: string
    description: string | null
    logoUrl: string | null
    coverImageUrl: string | null
    primaryColor: string
    accentColor: string
    phone: string | null
    addressLine: string | null
    city: string | null
    state: string | null
  }
  openingHours: { weekday: number; opensAt: string; closesAt: string }[]
  menu: {
    categories: { id: string; name: string; description: string | null; products: PublicMenuProduct[] }[]
    addonGroups: PublicMenuGroup[]
  }
}
