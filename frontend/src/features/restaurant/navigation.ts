import {
  BadgeDollarSign,
  ChartNoAxesCombined,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Palette,
  Settings,
  Tags,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { navHref, type NavGroup, type NavItem } from '@/layouts/navigation-types'
import type { Me } from '@/types/api'

export const RESTAURANT_HOME = '/app'
export const RESTAURANT_MODULES = '/app/modulos'

export const restaurantNavigation: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/app',
        phase: 3,
        permission: 'DASHBOARD_VIEW',
        summary: 'Indicadores do restaurante.',
        scope: [],
      },
      {
        key: 'pedidos',
        label: 'Pedidos',
        icon: ClipboardList,
        path: '/app/pedidos',
        phase: 4,
        permission: 'ORDERS_VIEW',
        summary: 'Pedidos das mesas em um Kanban em tempo real.',
        scope: [
          'Novos, em preparo, prontos, entregues, concluídos e cancelados',
          'Confirmação do pedido pelo restaurante antes da cozinha (configurável)',
          'Arrastar e soltar no desktop, com alternativa acessível',
          'Alertas sonoros e histórico de cada pedido',
          'Cancelamento sempre com motivo registrado',
        ],
      },
      {
        key: 'cozinha',
        label: 'Cozinha',
        icon: ChefHat,
        path: '/app/cozinha',
        phase: 4,
        permission: 'KITCHEN_OPERATE',
        module: 'KITCHEN',
        summary: 'Tela da cozinha pensada para tablets e monitores.',
        scope: [
          'Novos pedidos em tempo real com alerta sonoro',
          'Mesa, itens, adicionais e observações em fonte grande',
          'Iniciar preparo e marcar como pronto com um toque',
          'Tempo desde o recebimento e indicador de atraso',
          'Reconexão automática quando a internet oscilar',
        ],
      },
      {
        key: 'mesas',
        label: 'Mesas',
        icon: LayoutGrid,
        path: '/app/mesas',
        phase: 3,
        permission: 'TABLES_VIEW',
        summary: 'Mesas e plaquinhas vinculadas.',
        scope: [],
      },
    ],
  },
  {
    label: 'Cardápio',
    items: [
      {
        key: 'cardapio',
        label: 'Cardápio',
        icon: UtensilsCrossed,
        path: '/app/cardapio',
        phase: 3,
        permission: 'MENU_VIEW',
        summary: 'Produtos, adicionais e variações.',
        scope: [],
      },
      {
        key: 'categorias',
        label: 'Categorias',
        icon: Tags,
        path: '/app/categorias',
        phase: 3,
        permission: 'MENU_VIEW',
        summary: 'Seções do cardápio e a ordem de exibição.',
        scope: [],
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        key: 'funcionarios',
        label: 'Funcionários',
        icon: Users,
        path: '/app/funcionarios',
        phase: 3,
        permission: 'STAFF_MANAGE',
        summary: 'Acessos e perfis da equipe.',
        scope: [],
      },
      {
        key: 'financeiro',
        label: 'Financeiro',
        icon: BadgeDollarSign,
        path: '/app/financeiro',
        phase: 5,
        permission: 'FINANCE_VIEW',
        module: 'FINANCE',
        summary: 'Vendas, pagamentos registrados e cancelamentos.',
        scope: [
          'Total vendido, ticket médio e valor por período',
          'Registro de pagamento por Pix, dinheiro ou cartão',
          'Vendas por produto, categoria e mesa',
          'Pedidos pendentes de pagamento',
        ],
      },
      {
        key: 'relatorios',
        label: 'Relatórios',
        icon: ChartNoAxesCombined,
        path: '/app/relatorios',
        phase: 5,
        permission: 'FINANCE_VIEW',
        module: 'REPORTS',
        summary: 'Relatórios de vendas e operação por período.',
        scope: ['Filtros por período e comparação entre datas', 'Produtos mais vendidos', 'Horários de maior movimento', 'Exportação'],
      },
    ],
  },
  {
    label: 'Estabelecimento',
    items: [
      {
        key: 'personalizacao',
        label: 'Personalização',
        icon: Palette,
        path: '/app/personalizacao',
        phase: 3,
        permission: 'SETTINGS_MANAGE',
        summary: 'Marca, capa, descrição e horários do cardápio.',
        scope: [],
      },
      {
        key: 'configuracoes',
        label: 'Configurações',
        icon: Settings,
        path: '/app/configuracoes',
        phase: 3,
        permission: 'SETTINGS_MANAGE',
        summary: 'Contato, operação e plano.',
        scope: [],
      },
    ],
  },
]

export const can = (me: Me, permission?: string) => !permission || me.permissions.includes(permission)

/** Módulo opcional liberado pelo plano do restaurante. */
export const hasModule = (me: Me, module: string) => (me.modules ?? []).includes(module)

/** Somente os itens que o perfil pode usar; grupos vazios somem. */
export function navigationFor(me: Me): NavGroup[] {
  return restaurantNavigation
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => can(me, i.permission))
        .map((i) => ({ ...i, locked: Boolean(i.module && !hasModule(me, i.module)) })),
    }))
    .filter((g) => g.items.length > 0)
}

/** Itens com página de módulo: planejados (sem rota) ou que podem ser bloqueados pelo plano. */
export const restaurantPlannedModules: NavItem[] = restaurantNavigation.flatMap((g) => g.items).filter((i) => !i.path || i.module)

/** Primeira tela permitida para o perfil (usada quando não há acesso ao dashboard). */
export function firstAllowedPath(me: Me): string {
  // Perfil exclusivo da cozinha começa na tela da cozinha.
  if (can(me, 'KITCHEN_OPERATE') && !can(me, 'ORDERS_MANAGE')) return '/app/cozinha'
  const first = navigationFor(me)[0]?.items[0]
  return first ? navHref(first, RESTAURANT_MODULES) : RESTAURANT_HOME
}
