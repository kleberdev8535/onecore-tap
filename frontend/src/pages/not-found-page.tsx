import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <Logo />
      <p className="mt-10 text-sm font-semibold text-brand-700 tabular">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">O endereço pode ter mudado ou não existe mais.</p>
      <Button asChild variant="secondary" className="mt-8">
        <Link to="/">
          <ArrowLeft aria-hidden /> Voltar ao início
        </Link>
      </Button>
    </main>
  )
}
