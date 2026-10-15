import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@/features/auth/login-page'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { GuestOnly, RequireRole } from '@/features/auth/route-guards'
import { RequireModule } from '@/features/restaurant/plan-locked'
import { NotFoundPage } from '@/pages/not-found-page'
import { ApiError } from '@/services/http'

// Paineis carregados sob demanda: o login não baixa o código do Super Admin.
const AdminLayout = lazy(() => import('@/layouts/admin-layout').then((m) => ({ default: m.AdminLayout })))
const OverviewPage = lazy(() => import('@/features/admin/overview-page').then((m) => ({ default: m.OverviewPage })))
const RestaurantsPage = lazy(() => import('@/features/admin/restaurants-page').then((m) => ({ default: m.RestaurantsPage })))
const RestaurantDetailPage = lazy(() =>
  import('@/features/admin/restaurant-detail-page').then((m) => ({ default: m.RestaurantDetailPage })),
)
const RestaurantLayout = lazy(() => import('@/layouts/restaurant-layout').then((m) => ({ default: m.RestaurantLayout })))
const RequirePermission = lazy(() => import('@/layouts/restaurant-layout').then((m) => ({ default: m.RequirePermission })))
const RestaurantIndex = lazy(() => import('@/features/restaurant/restaurant-index').then((m) => ({ default: m.RestaurantIndex })))
const MenuPage = lazy(() => import('@/features/restaurant/menu/menu-page').then((m) => ({ default: m.MenuPage })))
const CategoriesPage = lazy(() => import('@/features/restaurant/menu/categories-page').then((m) => ({ default: m.CategoriesPage })))
const TablesPage = lazy(() => import('@/features/restaurant/tables-page').then((m) => ({ default: m.TablesPage })))
const StaffPage = lazy(() => import('@/features/restaurant/staff-page').then((m) => ({ default: m.StaffPage })))
const CustomizationPage = lazy(() =>
  import('@/features/restaurant/settings/customization-page').then((m) => ({ default: m.CustomizationPage })),
)
const RestaurantSettingsPage = lazy(() =>
  import('@/features/restaurant/settings/settings-page').then((m) => ({ default: m.RestaurantSettingsPage })),
)
const OrdersPage = lazy(() => import('@/features/orders/orders-page').then((m) => ({ default: m.OrdersPage })))
const FinancePage = lazy(() => import('@/features/finance/finance-page').then((m) => ({ default: m.FinancePage })))
const ReportsPage = lazy(() => import('@/features/finance/reports-page').then((m) => ({ default: m.ReportsPage })))
const KitchenPage = lazy(() => import('@/features/orders/kitchen-page').then((m) => ({ default: m.KitchenPage })))
const RestaurantPlannedPage = lazy(() =>
  import('@/features/restaurant/restaurant-planned-page').then((m) => ({ default: m.RestaurantPlannedPage })),
)
const AdminPlannedPage = lazy(() =>
  import('@/features/admin/planned-module-page').then((m) => ({ default: m.AdminPlannedPage })),
)

const PlatesPage = lazy(() => import('@/features/plates/plates-page').then((m) => ({ default: m.PlatesPage })))
const StockPage = lazy(() => import('@/features/plates/stock-page').then((m) => ({ default: m.StockPage })))
const PlansPage = lazy(() => import('@/features/plans/plans-page').then((m) => ({ default: m.PlansPage })))
const UsersPage = lazy(() => import('@/features/users/users-page').then((m) => ({ default: m.UsersPage })))
const AuditPage = lazy(() => import('@/features/audit/audit-page').then((m) => ({ default: m.AuditPage })))
const SubscriptionsPage = lazy(() => import('@/features/billing/subscriptions-page').then((m) => ({ default: m.SubscriptionsPage })))
const PlatformFinancePage = lazy(() => import('@/features/billing/platform-finance-page').then((m) => ({ default: m.PlatformFinancePage })))
const SettingsPage = lazy(() => import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage })))
const PublicMenuPage = lazy(() => import('@/features/public/menu-page').then((m) => ({ default: m.MenuPage })))
const OrderTrackingPage = lazy(() => import('@/features/public/order-tracking-page').then((m) => ({ default: m.OrderTrackingPage })))

const RESTAURANT_ROLES = ['RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'] as const

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
})

// Sessão expirada em qualquer requisicao: limpa o cache e volta para o login.
queryClient.getQueryCache().subscribe((event) => {
  const error = event.type === 'updated' ? event.query.state.error : null
  if (error instanceof ApiError && error.status === 401 && event.query.queryKey[0] !== 'auth') {
    queryClient.setQueryData(['auth', 'me'], null)
    window.location.assign(`/login?sessao=expirada&next=${encodeURIComponent(window.location.pathname)}`)
  }
})

const withSuspense = (node: ReactNode) => <Suspense fallback={null}>{node}</Suspense>
const guarded = (permission: string, node: ReactNode) => withSuspense(<RequirePermission permission={permission}>{node}</RequirePermission>)
/** Permissão do perfil + módulo do plano (sem o módulo, mostra a explicação em vez da tela). */
const moduleGuarded = (permission: string, module: string, key: string, node: ReactNode) =>
  guarded(permission, <RequireModule module={module} itemKey={key}>{node}</RequireModule>)

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: '/esqueci-senha', element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  {
    path: '/admin',
    element: <RequireRole roles={['SUPER_ADMIN']}>{withSuspense(<AdminLayout />)}</RequireRole>,
    children: [
      { index: true, element: withSuspense(<OverviewPage />) },
      { path: 'restaurantes', element: withSuspense(<RestaurantsPage />) },
      { path: 'restaurantes/:id', element: withSuspense(<RestaurantDetailPage />) },
      { path: 'plaquinhas', element: withSuspense(<PlatesPage />) },
      { path: 'estoque', element: withSuspense(<StockPage />) },
      { path: 'planos', element: withSuspense(<PlansPage />) },
      { path: 'usuarios', element: withSuspense(<UsersPage />) },
      { path: 'auditoria', element: withSuspense(<AuditPage />) },
      { path: 'configuracoes', element: withSuspense(<SettingsPage />) },
      { path: 'assinaturas', element: withSuspense(<SubscriptionsPage />) },
      { path: 'financeiro', element: withSuspense(<PlatformFinancePage />) },
      { path: 'modulos/:key', element: withSuspense(<AdminPlannedPage />) },
    ],
  },
  {
    path: '/app',
    element: <RequireRole roles={[...RESTAURANT_ROLES]}>{withSuspense(<RestaurantLayout />)}</RequireRole>,
    children: [
      { index: true, element: withSuspense(<RestaurantIndex />) },
      { path: 'cardapio', element: guarded('MENU_VIEW', <MenuPage />) },
      { path: 'categorias', element: guarded('MENU_VIEW', <CategoriesPage />) },
      { path: 'mesas', element: guarded('TABLES_VIEW', <TablesPage />) },
      { path: 'funcionarios', element: guarded('STAFF_MANAGE', <StaffPage />) },
      { path: 'personalizacao', element: guarded('SETTINGS_MANAGE', <CustomizationPage />) },
      { path: 'configuracoes', element: guarded('SETTINGS_MANAGE', <RestaurantSettingsPage />) },
      { path: 'pedidos', element: guarded('ORDERS_VIEW', <OrdersPage />) },
      { path: 'cozinha', element: moduleGuarded('KITCHEN_OPERATE', 'KITCHEN', 'cozinha', <KitchenPage />) },
      { path: 'financeiro', element: moduleGuarded('FINANCE_VIEW', 'FINANCE', 'financeiro', <FinancePage />) },
      { path: 'relatorios', element: moduleGuarded('FINANCE_VIEW', 'REPORTS', 'relatorios', <ReportsPage />) },
      { path: 'modulos/:key', element: withSuspense(<RestaurantPlannedPage />) },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },
  { path: '/t/:token', element: withSuspense(<PublicMenuPage />) },
  { path: '/t/:token/pedido/:tracking', element: withSuspense(<OrderTrackingPage />) },
  { path: '*', element: <NotFoundPage /> },
])

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast: '!rounded-xl !border-line !shadow-pop !font-sans',
                description: '!text-muted',
              },
            }}
          />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
