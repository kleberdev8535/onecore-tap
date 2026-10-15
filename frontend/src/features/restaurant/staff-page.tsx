import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleAlert, History, MailPlus, MoreHorizontal, Pencil, RotateCw, UserCheck, UserPlus, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { ReasonDialog } from '@/components/reason-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { auditActionLabels, parseDetails } from '@/features/audit/audit-labels'
import { useSession } from '@/features/auth/api'
import { FormAlert } from '@/features/auth/form-alert'
import { InviteLinkDialog } from '@/features/users/invite-link-dialog'
import { roleLabels } from '@/layouts/role-labels'
import { ApiError } from '@/services/http'
import type { Role, StaffMember } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatDateTime, initials } from '@/utils/format'
import { useInviteStaff, useResendStaffInvite, useSetStaffActive, useStaff, useStaffActivity, useUpdateStaff } from './api'

/** Perfis que o proprietário atribui, com o que cada um pode fazer (espelha as permissões do backend). */
const assignableRoles: { role: Role; description: string }[] = [
  { role: 'RESTAURANT_MANAGER', description: 'Cardápio, mesas, pedidos e financeiro. Não gerencia a equipe nem as configurações.' },
  { role: 'CASHIER', description: 'Consulta pedidos, mesas e cardápio e registra pagamentos.' },
  { role: 'WAITER', description: 'Acompanha e atualiza pedidos, consulta mesas e cardápio.' },
  { role: 'KITCHEN', description: 'Acessa somente a tela da cozinha.' },
]

type Invite = { link: string; name: string } | null

export function StaffPage() {
  const { data: me } = useSession()
  const staff = useStaff()
  const [inviting, setInviting] = useState(false)
  const [invite, setInvite] = useState<Invite>(null)
  const list = staff.data ?? []
  const active = list.filter((s) => s.active).length

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Funcionários"
        description="Cada pessoa tem o próprio acesso e vê apenas o que o perfil permite. Desativar ou mudar o perfil encerra as sessões abertas na hora."
        actions={<Button onClick={() => setInviting(true)}><UserPlus aria-hidden /> Convidar funcionário</Button>}
      />
      <Card className="overflow-hidden">
        {staff.isPending && <div className="divide-y divide-line" aria-busy>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-5 py-4"><Skeleton className="size-9 rounded-full" /><div><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-56" /></div></div>)}</div>}
        {staff.isError && <EmptyState icon={CircleAlert} title="Não foi possível carregar a equipe" description={staff.error.message} action={<Button variant="secondary" onClick={() => staff.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} />}
        {list.length > 0 && (
          <>
            <ul className="divide-y divide-line">
              {list.map((s) => <StaffRow key={s.id} member={s} self={s.id === me?.id} onInvite={(link) => setInvite({ link, name: s.name })} />)}
            </ul>
            <p className="border-t border-line px-5 py-3 text-[13px] text-muted">{active} {active === 1 ? 'acesso ativo' : 'acessos ativos'} de {list.length}</p>
          </>
        )}
        {staff.data?.length === 1 && (
          <div className="border-t border-line">
            <EmptyState icon={Users} title="Monte a sua equipe" description="Convide gerentes, caixas, garçons e a cozinha. Cada um recebe um link para criar a própria senha." className="py-10" />
          </div>
        )}
      </Card>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} onInvited={(link, name) => setInvite({ link, name })} />
      <InviteLinkDialog link={invite?.link ?? null} name={invite?.name ?? ''} onClose={() => setInvite(null)} />
    </>
  )
}

function StaffRow({ member: s, self, onInvite }: { member: StaffMember; self: boolean; onInvite: (link: string) => void }) {
  const setActive = useSetStaffActive()
  const resend = useResendStaffInvite()
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState(false)
  const [confirm, setConfirm] = useState<'deactivate' | 'activate' | null>(null)
  const owner = s.role === 'RESTAURANT_OWNER'
  const editable = !owner && !self

  const resendInvite = async () => {
    try {
      const result = await resend.mutateAsync(s.id)
      onInvite(result.inviteLink)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível gerar o convite.')
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', s.active ? 'bg-brand-50 text-brand-700' : 'bg-surface-muted text-muted')} aria-hidden>{initials(s.name)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-fg">{s.name}{self && <span className="font-normal text-muted"> (você)</span>}</span>
          <Badge tone={owner ? 'dark' : 'neutral'}>{roleLabels[s.role]}</Badge>
          {!s.active && <Badge tone="danger" dot>Desativado</Badge>}
          {s.active && s.pendingInvite && <Badge tone="warning" dot>Convite pendente</Badge>}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted">{s.email}</p>
        <p className="text-xs text-muted">{s.lastLoginAt ? `Último acesso em ${formatDateTime(s.lastLoginAt)}` : 'Ainda não acessou'}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações de ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setHistory(true)}><History aria-hidden /> Histórico de ações</DropdownMenuItem>
          {editable && (
            <>
              <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil aria-hidden /> Editar nome e perfil</DropdownMenuItem>
              {s.active && <DropdownMenuItem onSelect={resendInvite}><MailPlus aria-hidden /> Gerar novo convite</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {s.active
                ? <DropdownMenuItem onSelect={() => setConfirm('deactivate')} className="text-danger data-[highlighted]:text-danger [&_svg]:text-danger"><UserX aria-hidden /> Desativar acesso</DropdownMenuItem>
                : <DropdownMenuItem onSelect={() => setConfirm('activate')}><UserCheck aria-hidden /> Reativar acesso</DropdownMenuItem>}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && <EditDialog member={s} onClose={() => setEditing(false)} />}
      {history && <ActivityDialog member={s} onClose={() => setHistory(false)} />}
      {confirm && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm === 'deactivate' ? `Desativar ${s.name}` : `Reativar ${s.name}`}
          description={confirm === 'deactivate' ? 'O acesso é bloqueado e as sessões abertas são encerradas imediatamente.' : 'A pessoa volta a conseguir entrar com a senha atual. O limite de usuários do plano é verificado.'}
          confirmLabel={confirm === 'deactivate' ? 'Desativar' : 'Reativar'}
          tone={confirm === 'deactivate' ? 'danger' : 'primary'}
          requireReason={false}
          hideNote
          onConfirm={async () => {
            await setActive.mutateAsync({ id: s.id, active: confirm === 'activate' })
            toast.success(confirm === 'deactivate' ? 'Acesso desativado.' : 'Acesso reativado.')
          }}
        />
      )}
    </li>
  )
}

function RoleField({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-fg-secondary">Perfil de acesso</legend>
      <div role="radiogroup" aria-label="Perfil de acesso" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {assignableRoles.map(({ role, description }) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={value === role}
            onClick={() => onChange(role)}
            className={cn('rounded-lg border px-3 py-2.5 text-left transition-colors', value === role ? 'border-brand bg-brand-50 ring-1 ring-inset ring-brand' : 'border-line hover:bg-surface-muted')}
          >
            <span className="block text-sm font-medium text-fg">{roleLabels[role]}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted">{description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(120),
  email: z.string().trim().email('E-mail inválido').max(160),
})
type InviteForm = z.infer<typeof inviteSchema>

function InviteDialog({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: (link: string, name: string) => void }) {
  const invite = useInviteStaff()
  const [role, setRole] = useState<Role>('WAITER')
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteForm>({ resolver: zodResolver(inviteSchema), defaultValues: { name: '', email: '' } })

  const close = () => { setError(null); reset(); setRole('WAITER'); onClose() }
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      const result = await invite.mutateAsync({ name: v.name, email: v.email, role })
      close()
      onInvited(result.inviteLink, result.user.name)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível criar o acesso.')
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Convidar funcionário"
      description="A pessoa recebe um link de uso único (72 horas) para criar a própria senha."
      footer={<><Button variant="secondary" onClick={close}>Cancelar</Button><Button type="submit" form="invite-form" loading={invite.isPending}>Criar acesso</Button></>}
    >
      <FormAlert message={error} />
      <form id="invite-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name?.message}><Input autoComplete="off" {...register('name')} /></Field>
          <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="off" {...register('email')} /></Field>
        </div>
        <RoleField value={role} onChange={setRole} />
      </form>
    </Dialog>
  )
}

function EditDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const update = useUpdateStaff()
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState<Role>(member.role)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (name.trim().length < 2) return setError('Informe o nome.')
    setError(null)
    try {
      await update.mutateAsync({ id: member.id, name: name.trim(), role })
      toast.success('Funcionário atualizado.')
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Editar ${member.name}`}
      description={role !== member.role ? 'Ao mudar o perfil, as sessões abertas desta pessoa são encerradas.' : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={submit} loading={update.isPending}>Salvar</Button></>}
    >
      <FormAlert message={error} />
      <div className="flex flex-col gap-4">
        <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <Field label="E-mail" hint="O e-mail de acesso não pode ser alterado."><Input value={member.email} readOnly disabled /></Field>
        <RoleField value={role} onChange={setRole} />
      </div>
    </Dialog>
  )
}

function ActivityDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const activity = useStaffActivity(member.id)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Histórico de ${member.name}`} description="Últimas 50 ações feitas pela pessoa e alterações no acesso dela.">
      {activity.isPending && <div className="flex flex-col gap-3" aria-busy>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>}
      {activity.isError && <p className="text-sm text-danger">{activity.error.message}</p>}
      {activity.data?.length === 0 && <EmptyState className="py-6" icon={History} title="Nenhuma ação registrada" description="As ações aparecem aqui conforme a pessoa usa o painel." />}
      {activity.data && activity.data.length > 0 && (
        <ol className="flex flex-col divide-y divide-line">
          {activity.data.map((a) => {
            const details = parseDetails(a.details)
            return (
              <li key={a.id} className="py-2.5 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-fg">{auditActionLabels[a.action] ?? a.action}</span>
                  <time className="shrink-0 text-xs text-muted tabular" dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
                </div>
                <p className="text-xs text-muted">{a.actorEmail === member.email ? 'Pela própria pessoa' : `Por ${a.actorEmail ?? 'sistema'}`}{details && ` · ${details}`}</p>
              </li>
            )
          })}
        </ol>
      )}
    </Dialog>
  )
}
