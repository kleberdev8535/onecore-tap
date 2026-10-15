import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Lock } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSession } from '@/features/auth/api'
import type { NavItem } from '@/layouts/navigation-types'
import { RESTAURANT_HOME, hasModule, restaurantNavigation } from './navigation'

const moduleLabels: Record<string, string> = { KITCHEN: 'Painel da cozinha', FINANCE: 'Financeiro', REPORTS: 'Relatórios' }

/** Tela exibida quando o plano do restaurante não inclui o módulo. O backend também recusa (403). */
export function PlanLocked({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader eyebrow="Módulo do plano" title={item.label} description={item.summary} actions={<Badge tone="neutral"><Lock className="size-3" aria-hidden /> Não incluído no plano</Badge>} />
      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-fg-secondary">
              <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">O plano atual não inclui o módulo {moduleLabels[item.module ?? ''] ?? item.label}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Para liberar, fale com a OneCore Business sobre a mudança de plano. Pedidos, cardápio, mesas e o registro de pagamentos continuam funcionando normalmente.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="mt-6">
            <Link to={RESTAURANT_HOME}><ArrowLeft aria-hidden /> Voltar ao painel</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

/** Mostra a tela só se o plano incluir o módulo; caso contrário, a explicação. */
export function RequireModule({ module, itemKey, children }: { module: string; itemKey: string; children: ReactNode }) {
  const { data: me } = useSession()
  if (!me) return null
  if (hasModule(me, module)) return <>{children}</>
  const item = restaurantNavigation.flatMap((g) => g.items).find((i) => i.key === itemKey)
  return item ? <PlanLocked item={item} /> : null
}
