import type { Me } from '@/types/api'

/** Destino após o login conforme o perfil. */
export function homePathFor(me: Me): string {
  if (me.role === 'SUPER_ADMIN') return '/admin'
  if (me.role === 'KITCHEN') return '/app/cozinha'
  return '/app'
}

/** Aceita apenas caminhos internos, evitando redirecionamento aberto (?next=https://...). */
export function safeNextPath(next: string | null, me: Me): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return homePathFor(me)
  const isAdminPath = next === '/admin' || next.startsWith('/admin/')
  if (isAdminPath !== (me.role === 'SUPER_ADMIN')) return homePathFor(me)
  return next
}
