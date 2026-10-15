/** Rótulos em português das ações auditadas (enum AuditAction do backend). */
export const auditActionLabels: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Login realizado',
  LOGIN_FAILED: 'Falha de login',
  LOGIN_BLOCKED: 'Login bloqueado',
  LOGOUT: 'Saída',
  SESSION_REVOKED: 'Sessão encerrada pelo sistema',
  PASSWORD_RESET_REQUESTED: 'Redefinição de senha solicitada',
  PASSWORD_RESET_COMPLETED: 'Senha redefinida',
  INVITE_ACCEPTED: 'Convite aceito',
  SUPER_ADMIN_BOOTSTRAPPED: 'Super Admin inicial criado',
  SETTINGS_UPDATED: 'Configurações alteradas',
  RESTAURANT_CREATED: 'Restaurante cadastrado',
  RESTAURANT_UPDATED: 'Dados do restaurante alterados',
  RESTAURANT_BRANDING_UPDATED: 'Identidade visual alterada',
  RESTAURANT_PLAN_CHANGED: 'Plano alterado',
  RESTAURANT_STATUS_CHANGED: 'Status do restaurante alterado',
  TABLE_CREATED: 'Mesas cadastradas',
  CATEGORY_CREATED: 'Categoria criada',
  OWNER_INVITED: 'Proprietário convidado',
  INVITE_RESENT: 'Novo convite gerado',
  USER_ACTIVATED: 'Usuário reativado',
  USER_DEACTIVATED: 'Usuário desativado',
  PLAN_CREATED: 'Plano criado',
  PLAN_UPDATED: 'Plano alterado',
  PLATE_BATCH_CREATED: 'Lote de plaquinhas cadastrado',
  PLATE_STATUS_CHANGED: 'Plaquinha alterada',
  CATEGORY_UPDATED: 'Categoria alterada',
  CATEGORY_DELETED: 'Categoria excluída',
  CATEGORIES_REORDERED: 'Ordem das categorias alterada',
  PRODUCT_CREATED: 'Produto cadastrado',
  PRODUCT_UPDATED: 'Produto alterado',
  PRODUCT_DELETED: 'Produto excluído',
  PRODUCT_AVAILABILITY_CHANGED: 'Disponibilidade do produto alterada',
  PRODUCTS_REORDERED: 'Ordem dos produtos alterada',
  ADDON_GROUP_CREATED: 'Grupo de adicionais criado',
  ADDON_GROUP_UPDATED: 'Grupo de adicionais alterado',
  ADDON_GROUP_DELETED: 'Grupo de adicionais excluído',
  TABLE_UPDATED: 'Mesa alterada',
  STAFF_INVITED: 'Funcionário convidado',
  STAFF_ROLE_CHANGED: 'Perfil do funcionário alterado',
  RESTAURANT_HOURS_UPDATED: 'Horário de funcionamento alterado',
  RESTAURANT_SETTINGS_UPDATED: 'Configurações do restaurante alteradas',
}

/** Detalhes da auditoria (JSON) em texto curto, sem IDs internos. */
export function parseDetails(raw: string | null): string | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    return Object.entries(obj).filter(([k]) => !k.endsWith('Id')).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join('  ·  ')
  } catch {
    return raw
  }
}
