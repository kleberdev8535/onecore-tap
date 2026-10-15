import { useNavigate } from 'react-router'
import { ChevronsUpDown, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/api'
import type { Me } from '@/types/api'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'
import { roleLabels } from './role-labels'

export function UserMenu({ me, compact = false }: { me: Me; compact?: boolean }) {
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout.mutateAsync()
    } catch {
      // mesmo com falha de rede a sessão local e descartada
    }
    toast.success('Você saiu da sua conta.')
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          compact && 'justify-center',
        )}
        aria-label="Menu da conta"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
          {initials(me.name)}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-white">{me.name}</span>
              <span className="block truncate text-xs text-white/50">{roleLabels[me.role]}</span>
            </span>
            <ChevronsUpDown className="size-4 text-white/40" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-fg">{me.name}</span>
          <span className="block truncate text-xs font-normal text-muted">{me.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} disabled={logout.isPending}>
          <LogOut aria-hidden /> Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
