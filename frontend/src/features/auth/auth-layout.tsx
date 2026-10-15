import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { PlaqueIllustration } from '@/components/brand/plaque-illustration'

const CURRENT_YEAR = new Date().getFullYear()

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

/**
 * Layout das telas de acesso. Mobile: formulario em tela cheia. Desktop (lg+): painel da marca com a
 * plaquinha OneCore Tap a esquerda e o formulario a direita.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const reduce = useReducedMotion()
  return (
    <div className="flex min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Grade tecnica sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          aria-hidden
        />
        <Logo inverted className="relative" />

        <div className="relative flex flex-1 items-center justify-center py-12">
          <PlaqueIllustration />
        </div>

        <div className="relative max-w-md">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-white xl:text-[28px]">
            O pedido começa na mesa.
            <br />
            <span className="text-white/55">A gestão acontece aqui.</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Uma única plaquinha com NFC e QR Code conecta o cliente ao cardápio e coloca cada pedido direto no
            painel do seu restaurante.
          </p>
        </div>
      </aside>

      <main className="flex w-full flex-col px-4 py-8 sm:px-8 lg:px-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px]"
          >
            <h1 className="text-[26px] font-semibold tracking-tight text-fg">{title}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
        <p className="flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck className="size-3.5 text-brand-700" aria-hidden />
          Conexão protegida. OneCore Business &copy; {CURRENT_YEAR}
        </p>
      </main>
    </div>
  )
}
