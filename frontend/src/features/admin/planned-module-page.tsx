import { Link, Navigate, useParams } from 'react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { NavItem } from '@/layouts/navigation-types'
import { plannedModules } from './navigation'

/**
 * Página honesta para módulos ainda não entregues: mostra a fase e o escopo planejado, sem simular dados.
 */
export function PlannedModulePage({ modules, homePath, homeLabel, moduleKey }: { modules: NavItem[]; homePath: string; homeLabel: string; moduleKey?: string }) {
  const { key } = useParams()
  const item = modules.find((m) => m.key === (moduleKey ?? key))
  if (!item) return <Navigate to={homePath} replace />

  return (
    <>
      <PageHeader
        eyebrow="Módulo planejado"
        title={item.label}
        description={item.summary}
        actions={<Badge tone="info">Entrega na Fase {item.phase}</Badge>}
      />
      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">O que este módulo vai incluir</h2>
              <p className="mt-1 text-sm text-muted">Escopo aprovado para a Fase {item.phase} do plano de desenvolvimento.</p>
            </div>
          </div>
          <ul className="mt-6 flex flex-col gap-3">
            {item.scope.map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-fg-secondary">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary" className="mt-8">
            <Link to={homePath}>
              <ArrowLeft aria-hidden /> {homeLabel}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

export function AdminPlannedPage() {
  return <PlannedModulePage modules={plannedModules} homePath="/admin" homeLabel="Voltar para a visão geral" />
}
