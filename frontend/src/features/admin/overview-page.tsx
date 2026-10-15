import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  ArrowUpRight,
  BadgeDollarSign,
  CircleAlert,
  Nfc,
  Plus,
  RotateCw,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { KpiCard } from '@/components/kpi-card'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/api'
import type { AdminOverview } from '@/types/api'
import { formatNumber } from '@/utils/format'
import { useAdminOverview } from './api'
import { restaurantStatusMeta } from './restaurant-status-meta'

const listMotion = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const itemMotion = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export function OverviewPage() {
  const { data: me } = useSession()
  const overview = useAdminOverview()
  const firstName = me?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        eyebrow="OneCore Business"
        title={firstName ? `Olá, ${firstName}` : 'Visão geral'}
        description="Acompanhe a operação da OneCore Tap em todos os estabelecimentos."
        actions={
          <Button asChild>
            <Link to="/admin/restaurantes?novo=1">
              <Plus aria-hidden /> Novo restaurante
            </Link>
          </Button>
        }
      />

      {overview.isPending && <OverviewSkeleton />}

      {overview.isError && (
        <Card>
          <EmptyState
            icon={CircleAlert}
            title="Não foi possível carregar os indicadores"
            description={overview.error.message}
            action={
              <Button variant="secondary" onClick={() => overview.refetch()} loading={overview.isFetching}>
                <RotateCw aria-hidden /> Tentar novamente
              </Button>
            }
          />
        </Card>
      )}

      {overview.data && <OverviewContent data={overview.data} />}
    </>
  )
}

function OverviewContent({ data }: { data: AdminOverview }) {
  const r = data.restaurants
  const operating = r.active + r.trial

  return (
    <div className="flex flex-col gap-6">
      <motion.div variants={listMotion} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <motion.div variants={itemMotion}>
          <KpiCard icon={Store} label="Restaurantes" value={r.total} hint={`${formatNumber(r.createdThisMonth)} novos este mês`} />
        </motion.div>
        <motion.div variants={itemMotion}>
          <KpiCard icon={Store} label="Em operação" value={operating} hint={`${formatNumber(r.active)} ativos, ${formatNumber(r.trial)} em teste`} accent />
        </motion.div>
        <motion.div variants={itemMotion}>
          <KpiCard icon={CircleAlert} label="Suspensos" value={r.suspended} hint={`${formatNumber(r.cancelled)} cancelados`} />
        </motion.div>
        <motion.div variants={itemMotion}>
          <KpiCard icon={UserRound} label="Usuários de restaurantes" value={data.restaurantUsers} hint="Proprietários e equipes" />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribuição por status</CardTitle>
              <CardDescription>Situação atual de todos os estabelecimentos cadastrados.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/restaurantes">
                Ver todos <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {r.total === 0 ? (
              <EmptyState
                className="py-8"
                icon={Store}
                title="Nenhum restaurante cadastrado"
                description="Cadastre o primeiro estabelecimento para iniciar a implantação e acompanhar os indicadores aqui."
                action={
                  <Button asChild>
                    <Link to="/admin/restaurantes?novo=1">
                      <Plus aria-hidden /> Cadastrar restaurante
                    </Link>
                  </Button>
                }
              />
            ) : (
              <StatusDistribution data={data} />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Plaquinhas</CardTitle>
                <CardDescription>Estoque físico e plaquinhas em uso.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/plaquinhas">Gerenciar <ArrowUpRight aria-hidden /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-3">
                <PlateStat label="Em estoque" value={data.plates.available} />
                <PlateStat label="Ativas" value={data.plates.active} accent />
                <PlateStat label="Reservadas" value={data.plates.reserved} />
              </dl>
              {data.plates.suspended + data.plates.damaged > 0 && (
                <p className="mt-4 flex items-center gap-2 text-[13px] text-warning">
                  <Nfc className="size-4" aria-hidden /> {data.plates.suspended} suspensas e {data.plates.damaged} danificadas precisam de atenção.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Próximos indicadores</CardTitle>
                <CardDescription>Entram com o módulo comercial.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <UpcomingMetric icon={BadgeDollarSign} title="Receita recorrente (MRR) e inadimplência" phase={5} />
              <UpcomingMetric icon={BadgeDollarSign} title="Receita com venda de plaquinhas" phase={5} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const statusOrder = ['ACTIVE', 'TRIAL', 'ONBOARDING', 'SUSPENDED', 'CANCELLED'] as const
const statusBarColor: Record<(typeof statusOrder)[number], string> = {
  ACTIVE: 'bg-brand',
  TRIAL: 'bg-[#f5b544]',
  ONBOARDING: 'bg-info',
  SUSPENDED: 'bg-danger',
  CANCELLED: 'bg-line-strong',
}

function StatusDistribution({ data }: { data: AdminOverview }) {
  const r = data.restaurants
  const values: Record<(typeof statusOrder)[number], number> = {
    ACTIVE: r.active,
    TRIAL: r.trial,
    ONBOARDING: r.onboarding,
    SUSPENDED: r.suspended,
    CANCELLED: r.cancelled,
  }
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted" role="img" aria-label="Distribuição de restaurantes por status">
        {statusOrder.map((s) =>
          values[s] > 0 ? (
            <motion.div
              key={s}
              className={`${statusBarColor[s]} h-full border-r-2 border-surface last:border-r-0`}
              initial={{ width: 0 }}
              animate={{ width: `${(values[s] / r.total) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null,
        )}
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {statusOrder.map((s) => (
          <div key={s} className="flex items-start gap-2.5">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${statusBarColor[s]}`} aria-hidden />
            <div>
              <dt className="text-[13px] text-muted">{restaurantStatusMeta[s].label}</dt>
              <dd className="text-lg font-semibold text-fg tabular">
                {formatNumber(values[s])}
                <span className="ml-1.5 text-xs font-normal text-muted">{Math.round((values[s] / r.total) * 100)}%</span>
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PlateStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={accent ? 'rounded-lg bg-brand-50 p-3' : 'rounded-lg bg-surface-muted p-3'}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={accent ? 'mt-1 text-xl font-semibold text-brand-700 tabular' : 'mt-1 text-xl font-semibold text-fg tabular'}>{formatNumber(value)}</dd>
    </div>
  )
}

function UpcomingMetric({ icon: Icon, title, phase }: { icon: LucideIcon; title: string; phase: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3.5 py-3">
      <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 text-[13px] text-fg-secondary">{title}</span>
      <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted">Fase {phase}</span>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <span className="sr-only" role="status">Carregando indicadores</span>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-8 w-16" />
              <Skeleton className="mt-3 h-3.5 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-6 h-3 w-full rounded-full" />
        </CardContent>
      </Card>
    </div>
  )
}
