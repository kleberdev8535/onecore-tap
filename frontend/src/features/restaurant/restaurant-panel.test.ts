import { describe, expect, it } from 'vitest'
import type { Me, RestaurantSettings, Role } from '@/types/api'
import { choiceRule, isVariation } from './menu/addon-meta'
import { navHref } from '@/layouts/navigation-types'
import { firstAllowedPath, navigationFor } from './navigation'
import { contactFrom } from './settings/contact-input'
import { validateDay } from './settings/hours-rules'

// Espelha Role.java: o frontend só esconde o que o backend já bloqueia.
const permissionsOf: Record<Exclude<Role, 'SUPER_ADMIN'>, string[]> = {
  RESTAURANT_OWNER: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'ORDERS_MANAGE', 'KITCHEN_OPERATE', 'MENU_VIEW', 'MENU_MANAGE', 'TABLES_VIEW', 'TABLES_MANAGE', 'STAFF_MANAGE', 'FINANCE_VIEW', 'PAYMENTS_REGISTER', 'SETTINGS_MANAGE'],
  RESTAURANT_MANAGER: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'ORDERS_MANAGE', 'KITCHEN_OPERATE', 'MENU_VIEW', 'MENU_MANAGE', 'TABLES_VIEW', 'TABLES_MANAGE', 'FINANCE_VIEW', 'PAYMENTS_REGISTER'],
  CASHIER: ['ORDERS_VIEW', 'TABLES_VIEW', 'MENU_VIEW', 'FINANCE_VIEW', 'PAYMENTS_REGISTER'],
  WAITER: ['ORDERS_VIEW', 'ORDERS_MANAGE', 'TABLES_VIEW', 'MENU_VIEW'],
  KITCHEN: ['ORDERS_VIEW', 'KITCHEN_OPERATE'],
}

const me = (role: Exclude<Role, 'SUPER_ADMIN'>, modules = ['KITCHEN', 'FINANCE', 'REPORTS']): Me => ({ id: '1', name: 'Ana', email: 'a@a.dev', role, permissions: permissionsOf[role], restaurant: null, modules })
const keys = (m: Me) => navigationFor(m).flatMap((g) => g.items.map((i) => i.key))

describe('restaurant navigation', () => {
  it('locks modules the plan does not include and links them to the explanation page', () => {
    const items = navigationFor(me('RESTAURANT_OWNER', ['KITCHEN'])).flatMap((g) => g.items)
    const finance = items.find((i) => i.key === 'financeiro')!
    expect(finance.locked).toBe(true)
    expect(navHref(finance, '/app/modulos')).toBe('/app/modulos/financeiro')
    expect(items.find((i) => i.key === 'cozinha')!.locked).toBe(false)
    expect(navHref(items.find((i) => i.key === 'cozinha')!, '/app/modulos')).toBe('/app/cozinha')
  })

  it('lets the cashier reach finance and reports, never the waiter', () => {
    expect(keys(me('CASHIER'))).toEqual(expect.arrayContaining(['financeiro', 'relatorios']))
    expect(keys(me('WAITER'))).not.toContain('financeiro')
  })

  it('shows the owner every section of the spec', () => {
    expect(keys(me('RESTAURANT_OWNER'))).toEqual([
      'dashboard', 'pedidos', 'cozinha', 'mesas', 'cardapio', 'categorias', 'funcionarios', 'financeiro', 'relatorios', 'personalizacao', 'configuracoes',
    ])
  })

  it('hides staff and settings from managers', () => {
    const k = keys(me('RESTAURANT_MANAGER'))
    expect(k).toContain('cardapio')
    expect(k).not.toContain('funcionarios')
    expect(k).not.toContain('configuracoes')
  })

  it('gives the kitchen only the kitchen screen', () => {
    expect(keys(me('KITCHEN'))).toEqual(['pedidos', 'cozinha'])
    expect(navigationFor(me('KITCHEN')).every((g) => g.items.length > 0)).toBe(true)
  })

  it('sends roles without dashboard to their first allowed screen', () => {
    expect(firstAllowedPath(me('WAITER'))).toBe('/app/pedidos')
    expect(firstAllowedPath(me('KITCHEN'))).toBe('/app/cozinha')
    expect(firstAllowedPath(me('RESTAURANT_OWNER'))).toBe('/app')
  })
})

describe('opening hours rules', () => {
  it('accepts lunch and dinner and an overnight last range', () => {
    expect(validateDay([{ opensAt: '11:30', closesAt: '15:00' }, { opensAt: '18:00', closesAt: '02:00' }])).toBeNull()
  })

  it('rejects overlaps, equal times and overnight ranges that are not last', () => {
    expect(validateDay([{ opensAt: '11:00', closesAt: '15:00' }, { opensAt: '14:00', closesAt: '20:00' }])).toMatch(/sobrepostas/)
    expect(validateDay([{ opensAt: '10:00', closesAt: '10:00' }])).toMatch(/iguais/)
    expect(validateDay([{ opensAt: '18:00', closesAt: '01:00' }, { opensAt: '20:00', closesAt: '23:00' }])).toMatch(/última/)
  })
})

describe('addon choice rules', () => {
  it('describes variations and optional add-ons', () => {
    expect(isVariation({ minChoices: 1, maxChoices: 1 })).toBe(true)
    expect(choiceRule({ minChoices: 1, maxChoices: 1 })).toBe('Escolha obrigatória de 1 opção')
    expect(choiceRule({ minChoices: 0, maxChoices: 3 })).toBe('Opcional, até 3 opções')
    expect(choiceRule({ minChoices: 2, maxChoices: 4 })).toBe('Escolha de 2 a 4 opções')
  })
})

describe('contactFrom', () => {
  it('keeps the other contact fields when only the description changes', () => {
    const settings = { email: 'a@b.dev', phone: '11999990000', addressLine: null, city: 'Santos', state: 'SP', postalCode: null, description: 'Antiga' } as RestaurantSettings
    expect(contactFrom(settings, { description: 'Nova' })).toEqual({
      email: 'a@b.dev', phone: '11999990000', addressLine: undefined, city: 'Santos', state: 'SP', postalCode: undefined, description: 'Nova',
    })
    expect(contactFrom(settings, { description: '' }).description).toBeUndefined()
  })
})
