import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, CircleAlert, MailPlus, MoreHorizontal, RotateCw, Search, SearchX, UserCheck, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminUsers, useResendInvite, useSetUserActive, type UserQuery } from '@/features/admin/management-api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { roleLabels } from '@/layouts/role-labels'
import { ApiError } from '@/services/http'
import type { AdminUser, Role } from '@/types/api'
import { cn } from '@/utils/cn'
import { InviteLinkDialog } from './invite-link-dialog'
import { formatDateTime, formatNumber, initials } from '@/utils/format'

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [active, setActive] = useState<UserQuery['active']>('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedValue(search)
  const query = useAdminUsers({ search: debounced, role, active, page })
  const data = query.data

  return (
    <>
      <PageHeader eyebrow="Gestão" title="Usuários" description="Acessos de proprietários e equipes dos restaurantes. Desativar um acesso encerra as sessões abertas na hora." />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row">
          <div className="flex-1">
            <label htmlFor="user-search" className="sr-only">Buscar usuários</label>
            <Input id="user-search" type="search" placeholder="Buscar por nome ou e-mail" leading={<Search />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-96">
            <Select aria-label="Filtrar por perfil" value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(0) }}>
              <option value="">Todos os perfis</option>
              {(Object.keys(roleLabels) as Role[]).map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
            </Select>
            <Select aria-label="Filtrar por situação" value={active} onChange={(e) => { setActive(e.target.value as UserQuery['active']); setPage(0) }}>
              <option value="">Todas as situações</option>
              <option value="true">Ativos</option>
              <option value="false">Desativados</option>
            </Select>
          </div>
        </div>

        {query.isPending && <div className="divide-y divide-line" aria-busy>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-4 py-4"><Skeleton className="size-9 rounded-full" /><div><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-56" /></div></div>)}</div>}
        {query.isError && <EmptyState icon={CircleAlert} title="Não foi possível carregar os usuários" description={query.error.message} action={<Button variant="secondary" onClick={() => query.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />}
        {data && data.items.length === 0 && (debounced || role || active
          ? <EmptyState icon={SearchX} title="Nenhum usuário encontrado" description="Ajuste a busca ou os filtros." />
          : <EmptyState icon={Users} title="Nenhum usuário ainda" description="Os acessos são criados ao convidar o proprietário na implantação de cada restaurante." />)}

        {data && data.items.length > 0 && (
          <>
            <ul className={cn('divide-y divide-line', query.isPlaceholderData && 'opacity-60')}>
              {data.items.map((u) => <UserRow key={u.id} user={u} />)}
            </ul>
            <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
              <p className="text-[13px] text-muted">{formatNumber(data.totalItems)} usuários</p>
              {data.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon-sm" aria-label="Página anterior" disabled={data.page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button>
                  <Button variant="secondary" size="icon-sm" aria-label="Próxima página" disabled={data.page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  const setActive = useSetUserActive()
  const resend = useResendInvite()
  const [confirm, setConfirm] = useState<'deactivate' | 'activate' | null>(null)
  const [invite, setInvite] = useState<string | null>(null)
  const platform = user.role === 'SUPER_ADMIN'

  const resendInvite = async () => {
    try {
      const result = await resend.mutateAsync(user.id)
      setInvite(result.inviteLink)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível gerar o convite.')
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', user.active ? 'bg-brand-50 text-brand-700' : 'bg-surface-muted text-muted')} aria-hidden>{initials(user.name)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-fg">{user.name}</span>
          <Badge tone={platform ? 'dark' : 'neutral'}>{roleLabels[user.role]}</Badge>
          {!user.active && <Badge tone="danger" dot>Desativado</Badge>}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {user.email}
          {user.restaurantName && <> · <Link to={`/admin/restaurantes/${user.restaurantId}`} className="hover:underline">{user.restaurantName}</Link></>}
        </p>
        <p className="text-xs text-muted">{user.lastLoginAt ? `Último acesso em ${formatDateTime(user.lastLoginAt)}` : 'Ainda não acessou'}</p>
      </div>
      {!platform && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações de ${user.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user.active && <DropdownMenuItem onSelect={resendInvite}><MailPlus aria-hidden /> Gerar novo convite</DropdownMenuItem>}
            {user.active
              ? <DropdownMenuItem onSelect={() => setConfirm('deactivate')} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger"><UserX aria-hidden /> Desativar acesso</DropdownMenuItem>
              : <DropdownMenuItem onSelect={() => setConfirm('activate')}><UserCheck aria-hidden /> Reativar acesso</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {confirm && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm === 'deactivate' ? `Desativar ${user.name}` : `Reativar ${user.name}`}
          description={confirm === 'deactivate' ? 'O acesso é bloqueado e as sessões abertas são encerradas imediatamente.' : 'O usuário volta a conseguir entrar com a senha atual.'}
          confirmLabel={confirm === 'deactivate' ? 'Desativar' : 'Reativar'}
          tone={confirm === 'deactivate' ? 'danger' : 'primary'}
          requireReason={false}
          onConfirm={async () => {
            await setActive.mutateAsync({ id: user.id, active: confirm === 'activate' })
            toast.success(confirm === 'deactivate' ? 'Acesso desativado.' : 'Acesso reativado.')
          }}
        />
      )}
      <InviteLinkDialog link={invite} name={user.name} onClose={() => setInvite(null)} />
    </li>
  )
}
