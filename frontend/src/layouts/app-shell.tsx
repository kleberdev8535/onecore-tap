import { useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/api'
import { AppSidebar } from './app-sidebar'
import type { NavGroup } from './navigation-types'
import { useSidebarState } from './use-sidebar-state'

interface AppShellProps {
  groups: NavGroup[]
  homePath: string
  modulesBase: string
  context?: ReactNode
}

/** Estrutura dos painéis: sidebar recolhível no desktop, barra superior e drawer no mobile. */
export function AppShell({ groups, homePath, modulesBase, context }: AppShellProps) {
  const { data: me } = useSession()
  const { collapsed, toggle } = useSidebarState()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  if (!me) return null

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-md bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      {/* Desktop: sidebar fixa e recolhivel */}
      <motion.aside
        className="fixed inset-y-0 left-0 z-30 hidden overflow-hidden lg:block"
        initial={false}
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <AppSidebar me={me} groups={groups} homePath={homePath} modulesBase={modulesBase} context={context} collapsed={collapsed} onToggle={toggle} />
      </motion.aside>

      {/* Mobile/tablet: barra superior + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </DialogPrimitive.Trigger>
          <AnimatePresence>
            {drawerOpen && (
              <DialogPrimitive.Portal forceMount>
                <DialogPrimitive.Overlay asChild forceMount>
                  <motion.div
                    className="fixed inset-0 z-40 bg-ink/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  />
                </DialogPrimitive.Overlay>
                <DialogPrimitive.Content asChild forceMount>
                  <motion.div
                    className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] shadow-pop focus:outline-none"
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">Navegação do painel</DialogPrimitive.Description>
                    <DialogPrimitive.Close
                      className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-md text-white/60 hover:bg-white/[0.06] hover:text-white"
                      aria-label="Fechar menu"
                    >
                      <X className="size-5" />
                    </DialogPrimitive.Close>
                    <AppSidebar me={me} groups={groups} homePath={homePath} modulesBase={modulesBase} context={context} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
                  </motion.div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            )}
          </AnimatePresence>
        </DialogPrimitive.Root>
      </header>

      <div
        className={`transition-[padding] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]'}`}
      >
        <main id="conteudo" className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          {/* Somente entrada (sem esperar a saida da tela anterior): navegacao instantanea no uso diario. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
