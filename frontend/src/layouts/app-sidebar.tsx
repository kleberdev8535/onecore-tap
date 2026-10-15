import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { motion } from 'motion/react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Tooltip } from '@/components/ui/tooltip'
import type { Me } from '@/types/api'
import { cn } from '@/utils/cn'
import { navHref, type NavGroup } from './navigation-types'
import { UserMenu } from './user-menu'

export interface AppSidebarProps {
  me: Me
  groups: NavGroup[]
  /** Rota do item inicial (casamento exato) e base das páginas de módulos planejados. */
  homePath: string
  modulesBase: string
  /** Identificação do contexto abaixo do logo (ex.: nome do restaurante). */
  context?: ReactNode
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
}

/** Navegação lateral dos painéis. Usada fixa no desktop e dentro do drawer no mobile. */
export function AppSidebar({ me, groups, homePath, modulesBase, context, collapsed, onToggle, onNavigate }: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-ink text-white">
      <div className={cn('flex h-16 shrink-0 items-center px-4', collapsed ? 'justify-center' : 'justify-between')}>
        <Logo inverted showWordmark={!collapsed} />
        {onToggle && !collapsed && (
          <Tooltip content="Recolher menu  [" side="right">
            <button
              type="button"
              onClick={onToggle}
              className="flex size-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Recolher menu"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </Tooltip>
        )}
      </div>

      {context && !collapsed && <div className="px-3 pb-1">{context}</div>}

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="mt-4 first:mt-1">
            {!collapsed ? (
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">{group.label}</p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <Tooltip content={item.label} side="right" disabled={!collapsed}>
                    <NavLink
                      to={navHref(item, modulesBase)}
                      end={item.path === homePath}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors duration-150',
                          collapsed && 'justify-center px-0',
                          isActive ? 'text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId={`nav-active-${modulesBase}`}
                              className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-inset ring-white/[0.06]"
                              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                            />
                          )}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" aria-hidden />
                          )}
                          <item.icon
                            className={cn('relative size-[18px] shrink-0', isActive ? 'text-brand' : 'text-white/50 group-hover:text-white/80')}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                          {!collapsed && item.locked && (
                            <span className="relative rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/45">Plano</span>
                          )}
                          {!collapsed && !item.path && !item.locked && (
                            <span className="relative rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/45">
                              Fase {item.phase}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.08] p-3">
        {onToggle && collapsed && (
          <Tooltip content="Expandir menu  [" side="right">
            <button
              type="button"
              onClick={onToggle}
              className="mb-2 flex h-10 w-full items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Expandir menu"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </Tooltip>
        )}
        <UserMenu me={me} compact={collapsed} />
      </div>
    </div>
  )
}
