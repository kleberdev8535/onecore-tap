import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  ImageOff,
  LayoutGrid,
  PackageX,
  RotateCw,
  Tags,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { KpiCard } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { restaurantStatusMeta } from '@/features/admin/restaurant-status-meta'
import { useSession } from '@/features/auth/api'
import type { RestaurantDashboard, SalesPeriod } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatDate, formatNumber, plural } from '@/utils/format'
import { useRestaurantDashboard } from './api'
import { PeriodFilter, SalesSection } from './sales-section'

const listMotion = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const itemMotion = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const setupLinks: Record<string, string | undefined> = {
  branding: '/app/personalizacao',
  hours: '/app/personalizacao',
  categories: '/app/categorias',
  products: '/app/cardapio',
  tables: '/app/mesas',
}

export function RestaurantDashboardPage() {
  const { data: me } = useSession()
  const [period, setPeriod] = useState<SalesPeriod>('today')
  const dashboard = useRestaurantDashboard(period)
  const firstName = me?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        eyebrow={me?.restaurant?.tradeName}
        title={firstName ? `Olá, ${firstName}` : 'Dashboard'}
        description="Vendas e operação do restaurante com dados reais dos pedidos."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />
      {dashboard.isPending && <DashboardSkeleton />}
      {dashboard.isError && (
        <Card>
          <EmptyState
            icon={CircleAlert}
            title="Não foi possível carregar os indicadores"
            description={dashboard.error.message}
            action={<Button variant="secondary" onClick={() => dashboard.refetch()} loading={dashboard.isFetching}><RotateCw aria-hidden /> Tentar novamente</Button>}
          />
        </Card>
      )}
      {dashboard.data && <DashboardContent data={dashboard.data} loading={dashboard.isPlaceholderData} />}
    </>
  )
}

function DashboardContent({ data, loading }: { data: RestaurantDashboard; loading: boolean }) {
  const done = data.setup.filter((s) => s.done).length
  const complete = done === data.setup.length
  const status = restaurantStatusMeta[data.status]

  return (
    <div className="flex flex-col gap-6">
      {data.status !== 'ACTIVE' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-fg-secondary">
          <Badge tone={status.tone} dot>{status.label}</Badge>
          {data.status === 'ONBOARDING' && 'A OneCore Business está concluindo a implantação. O cardápio é liberado aos clientes após a ativação.'}
          {data.status === 'TRIAL' && (data.trialEndsAt ? `Período de teste até ${formatDate(data.trialEndsAt)}.` : 'Período de teste em andamento.')}
          {data.status === 'SUSPENDED' && 'O cardápio está indisponível aos clientes. Fale com a OneCore Business.'}
        </div>
      )}

      <SalesSection sales={data.sales} loading={loading} />

      <h2 className="mt-2 text-[15px] font-semibold text-fg">Cardápio, mesas e equipe</h2>
      <motion.div variants={listMotion} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <motion.div variants={itemMotion}>
          <KpiCard icon={UtensilsCrossed} label="Produtos ativos" value={data.menu.activeProducts} hint={data.menu.unavailableProducts ? `${plural(data.menu.unavailableProducts, 'esgotado', 'esgotados')} agora` : 'Nenhum esgotado'} accent />
        </motion.div>
        <motion.div variants={itemMotion}>
          <KpiCard icon={Tags} label="Categorias" value={data.menu.activeCategories} hint={plural(data.menu.addonGroups, 'grupo de adicionais', 'grupos de adicionais')} />
        </motion.div>
        <motion.div variants={itemMotion}>
          <KpiCard icon={LayoutGrid} label="Mesas ativas" value={data.tables.active} hint={`${formatNumber(data.tables.withPlate)} com plaquinha${data.plan?.maxTables ? ` · limite ${data.plan.maxTables}` : ''}`} />
        </motion.div>
        <motion.div variants={itemMotion}>
          <KpiCard icon={Users} label="Equipe ativa" value={data.staff.active} hint={data.staff.pendingInvites ? `${plural(data.staff.pendingInvites, 'pessoa', 'pessoas')} sem primeiro acesso` : 'Todos já acessaram'} />
        </motion.div>
      </motion.div>

      <div className={cn('grid grid-cols-1 gap-6', !complete && 'xl:grid-cols-2')}>
        {!complete && <SetupChecklist data={data} done={done} />}
        <Attention data={data} />
      </div>
    </div>
  )
}

function SetupChecklist({ data, done }: { data: RestaurantDashboard; done: number }) {
  const pct = Math.round((done / data.setup.length) * 100)
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Configuração do restaurante</CardTitle>
          <CardDescription>{done} de {data.setup.length} etapas concluídas.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da configuração">
          <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <ul className="mt-4 flex flex-col">
          {data.setup.map((step) => {
            const href = setupLinks[step.key]
            const body = (
              <>
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border', step.done ? 'border-brand bg-brand text-white' : 'border-line-strong text-transparent')} aria-hidden>
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', step.done ? 'text-muted line-through decoration-line-strong' : 'text-fg')}>{step.label}</span>
                  <span className="block text-xs text-muted">{step.hint}</span>
                </span>
                <span className="sr-only">{step.done ? 'Concluída' : 'Pendente'}</span>
                {!step.done && href && <ArrowUpRight className="size-4 text-muted" aria-hidden />}
              </>
            )
            return (
              <li key={step.key}>
                {!step.done && href ? (
                  <Link to={href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-muted">{body}</Link>
                ) : (
                  <div className="-mx-2 flex items-center gap-3 px-2 py-2.5">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function Attention({ data }: { data: RestaurantDashboard }) {
  const items = [
    data.menu.unavailableProducts > 0 && { icon: PackageX, text: plural(data.menu.unavailableProducts, 'produto marcado como esgotado', 'produtos marcados como esgotados'), href: '/app/cardapio' },
    data.menu.emptyCategories.length > 0 && { icon: Tags, text: `Categorias sem produtos: ${data.menu.emptyCategories.join(', ')}`, href: '/app/cardapio' },
    data.menu.productsWithoutImage > 0 && { icon: ImageOff, text: plural(data.menu.productsWithoutImage, 'produto sem foto', 'produtos sem foto'), href: '/app/cardapio' },
    data.tables.active > data.tables.withPlate && { icon: LayoutGrid, text: plural(data.tables.active - data.tables.withPlate, 'mesa ativa sem plaquinha', 'mesas ativas sem plaquinha'), href: '/app/mesas' },
  ].filter(Boolean) as { icon: typeof Tags; text: string; href: string }[]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pontos de atenção</CardTitle>
          <CardDescription>O que pode melhorar a experiência no cardápio.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success"><Check className="size-4" aria-hidden /> Tudo em ordem no cardápio e nas mesas.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.text}>
                <Link to={item.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg">
                  <item.icon className="size-4 shrink-0 text-warning" aria-hidden />
                  <span className="flex-1">{item.text}</span>
                  <ArrowUpRight className="size-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[124px] rounded-xl" />)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
    </div>
  )
}
