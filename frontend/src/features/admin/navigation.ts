import {
  BadgeDollarSign,
  Boxes,
  ChartNoAxesCombined,
  CreditCard,
  LayoutDashboard,
  Layers,
  Nfc,
  ScrollText,
  Settings,
  Store,
  Users,
} from 'lucide-react'
import { navHref, type NavGroup, type NavItem } from '@/layouts/navigation-types'

export type AdminNavItem = NavItem
export type AdminNavGroup = NavGroup

export const adminNavigation: AdminNavGroup[] = [
  {
    label: 'Operação',
    items: [
      {
        key: 'visao-geral',
        label: 'Visão geral',
        icon: LayoutDashboard,
        path: '/admin',
        phase: 1,
        summary: 'Indicadores globais da plataforma.',
        scope: [],
      },
      {
        key: 'restaurantes',
        label: 'Restaurantes',
        icon: Store,
        path: '/admin/restaurantes',
        phase: 1,
        summary: 'Cadastro e acompanhamento dos estabelecimentos.',
        scope: [],
      },
      {
        key: 'plaquinhas',
        path: '/admin/plaquinhas',
        label: 'Plaquinhas',
        icon: Nfc,
        phase: 2,
        summary: 'Plaquinhas NFC + QR Code com URL permanente e vinculação dinâmica a restaurante e mesa.',
        scope: [
          'Token público aleatório e URL permanente por plaquinha',
          'Vincular, desvincular e transferir entre restaurantes e mesas',
          'Histórico completo de vinculações',
          'Exportação de QR Code em SVG, PNG e PDF de impressão',
        ],
      },
      {
        key: 'estoque',
        path: '/admin/estoque',
        label: 'Estoque',
        icon: Boxes,
        phase: 2,
        summary: 'Inventário físico das plaquinhas por lote.',
        scope: [
          'Cadastro individual e em lote',
          'Estados: disponível, reservada, ativa, suspensa, danificada e desativada',
          'Data de fabricação e lote',
        ],
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      {
        key: 'assinaturas',
        path: '/admin/assinaturas',
        label: 'Assinaturas',
        icon: CreditCard,
        phase: 5,
        summary: 'Assinaturas dos restaurantes, vencimentos e pagamentos.',
        scope: [
          'Período de teste, vencimentos e status de pagamento',
          'Suspensão e reativação conforme regras',
          'Upgrades e downgrades',
          'Estrutura pronta para integrar um provedor de pagamento',
        ],
      },
      {
        key: 'planos',
        path: '/admin/planos',
        label: 'Planos',
        icon: Layers,
        phase: 2,
        summary: 'Planos configuráveis: valores, limites e funcionalidades.',
        scope: ['Valores sem preço fixo no código', 'Limites de mesas e usuários', 'Funcionalidades por plano'],
      },
      {
        key: 'financeiro',
        path: '/admin/financeiro',
        label: 'Financeiro',
        icon: BadgeDollarSign,
        phase: 5,
        summary: 'Receita da OneCore Business: MRR, venda de plaquinhas e inadimplência.',
        scope: [
          'Receita recorrente mensal',
          'Receita com venda de plaquinhas (preço configurável)',
          'Inadimplência e cancelamentos',
        ],
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        key: 'usuarios',
        path: '/admin/usuarios',
        label: 'Usuários',
        icon: Users,
        phase: 2,
        summary: 'Acessos dos proprietários e da equipe OneCore Business.',
        scope: ['Criação do usuário proprietário na implantação', 'Ativar e desativar acessos', 'Convites'],
      },
      {
        key: 'relatorios',
        label: 'Relatórios',
        icon: ChartNoAxesCombined,
        phase: 6,
        summary: 'Relatórios de uso da plataforma por período (a receita já está em Financeiro).',
        scope: ['Filtros por período', 'Comparação entre datas', 'Exportação'],
      },
      {
        key: 'auditoria',
        path: '/admin/auditoria',
        label: 'Auditoria',
        icon: ScrollText,
        phase: 2,
        summary: 'Trilha de ações sensíveis.',
        scope: ['Logins, falhas e bloqueios', 'Ações do Super Admin', 'Filtros por restaurante, usuário e período'],
      },
      {
        key: 'configuracoes',
        path: '/admin/configuracoes',
        label: 'Configurações',
        icon: Settings,
        phase: 2,
        summary: 'Parâmetros globais da plataforma.',
        scope: ['Preço padrão da plaquinha', 'Domínio público das URLs', 'Políticas de segurança'],
      },
    ],
  },
]

export const plannedModules = adminNavigation.flatMap((g) => g.items).filter((i) => !i.path)

export function moduleHref(item: AdminNavItem) {
  return navHref(item, '/admin/modulos')
}
