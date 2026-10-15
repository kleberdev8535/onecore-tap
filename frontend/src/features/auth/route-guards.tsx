import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { LogoMark } from '@/components/brand/logo'
import type { Role } from '@/types/api'
import { useSession } from './api'
import { homePathFor } from './home-path'

function FullscreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status" aria-label="Carregando">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  )
}

/** Protege rotas no cliente. A autorizacao real e sempre aplicada pelo backend. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const session = useSession()
  const location = useLocation()

  if (session.isPending) return <FullscreenLoader />
  const me = session.data
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (!roles.includes(me.role)) return <Navigate to={homePathFor(me)} replace />
  return <>{children}</>
}

/** Telas públicas de acesso: quem já esta logado vai direto para o seu painel. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession()
  if (session.isPending) return <FullscreenLoader />
  if (session.data) return <Navigate to={homePathFor(session.data)} replace />
  return <>{children}</>
}
