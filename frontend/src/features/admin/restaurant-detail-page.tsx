import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Building2, CircleAlert, LayoutGrid, Layers, ListChecks, Nfc, Palette, UserRound, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/services/http'
import { formatDate } from '@/utils/format'
import { readableTextOn } from '@/utils/color'
import { useRestaurant } from './api'
import { useOnboarding } from './management-api'
import { RestaurantStatusBadge } from './restaurant-status'
import { BrandingTab } from './restaurant/branding-tab'
import { DetailsTab } from './restaurant/details-tab'
import { OnboardingTab } from './restaurant/onboarding-tab'
import { OwnerTab } from './restaurant/owner-tab'
import { PlanTab } from './restaurant/plan-tab'
import { PlatesTab } from './restaurant/plates-tab'
import { TablesTab } from './restaurant/tables-tab'
import { BillingTab } from '@/features/billing/billing-tab'

const tabs = [
  { value: 'implantacao', label: 'Implantação', icon: ListChecks },
  { value: 'dados', label: 'Dados', icon: Building2 },
  { value: 'identidade', label: 'Identidade visual', icon: Palette },
  { value: 'plano', label: 'Plano', icon: Layers },
  { value: 'proprietario', label: 'Proprietário', icon: UserRound },
  { value: 'mesas', label: 'Mesas', icon: LayoutGrid },
  { value: 'plaquinhas', label: 'Plaquinhas', icon: Nfc },
  { value: 'cobranca', label: 'Cobrança', icon: Receipt },
] as const

export function RestaurantDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const query = useRestaurant(id)
  const onboarding = useOnboarding(id)
  const tab = tabs.some((t) => t.value === params.get('aba')) ? params.get('aba')! : 'implantacao'
  const goTo = (value: string) => setParams({ aba: value }, { replace: true })
  const r = query.data

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link to="/admin/restaurantes"><ArrowLeft aria-hidden /> Restaurantes</Link>
      </Button>

      {(query.isPending || onboarding.isPending) && !query.isError && (
        <div aria-busy>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-3 h-4 w-40" />
          <Skeleton className="mt-8 h-11 w-full" />
          <Skeleton className="mt-6 h-64 w-full rounded-xl" />
        </div>
      )}

      {query.isError && (
        <Card>
          <EmptyState
            icon={CircleAlert}
            title={query.error instanceof ApiError && query.error.status === 404 ? 'Restaurante não encontrado' : 'Erro ao carregar'}
            description={query.error.message}
            action={<Button asChild variant="secondary"><Link to="/admin/restaurantes">Voltar para a lista</Link></Button>}
          />
        </Card>
      )}

      {r && onboarding.data && (
        <>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-semibold shadow-card"
              style={{ backgroundColor: r.accentColor, color: readableTextOn(r.accentColor) }}
              aria-hidden
            >
              {r.logoUrl ? <img src={r.logoUrl} alt="" className="size-full object-cover" /> : r.tradeName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">{r.tradeName}</h1>
                <RestaurantStatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {r.slug} &middot; cadastrado em {formatDate(r.createdAt)} &middot; implantação {onboarding.data.done}/{onboarding.data.total}
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={goTo}>
            <TabsList aria-label="Seções do restaurante" className="mb-6">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  <t.icon aria-hidden /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="implantacao"><OnboardingTab restaurant={r} onboarding={onboarding.data} onGoTo={goTo} /></TabsContent>
            <TabsContent value="dados"><DetailsTab restaurant={r} /></TabsContent>
            <TabsContent value="identidade"><BrandingTab key={r.id} restaurant={r} /></TabsContent>
            <TabsContent value="plano"><PlanTab restaurantId={r.id} onboarding={onboarding.data} /></TabsContent>
            <TabsContent value="proprietario"><OwnerTab restaurantId={r.id} onboarding={onboarding.data} /></TabsContent>
            <TabsContent value="mesas"><TablesTab restaurantId={r.id} onboarding={onboarding.data} /></TabsContent>
            <TabsContent value="plaquinhas"><PlatesTab restaurantId={r.id} /></TabsContent>
            <TabsContent value="cobranca"><BillingTab restaurantId={r.id} /></TabsContent>
          </Tabs>
        </>
      )}
    </>
  )
}
