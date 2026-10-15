import { beforeEach, describe, expect, it } from 'vitest'
import type { OrderView, PublicMenuGroup } from '@/types/api'
import { contrastRatio } from '@/utils/color'
import { cartCount, cartTotal, useCart } from '@/features/public/cart-store'
import { estimateUnit, groupStatus, menuTheme, toggleOption } from '@/features/public/menu-logic'
import { customerStatus, stepIndex } from '@/features/public/status-steps'
import { canRun, dropTarget } from './order-meta'

const size: PublicMenuGroup = { id: 'g1', name: 'Tamanho', minChoices: 1, maxChoices: 1, options: [{ id: 's', name: 'Simples', priceCents: 0, available: true }, { id: 'd', name: 'Duplo', priceCents: 1200, available: true }] }
const extras: PublicMenuGroup = { id: 'g2', name: 'Adicionais', minChoices: 0, maxChoices: 2, options: [{ id: 'b', name: 'Bacon', priceCents: 500, available: true }, { id: 'q', name: 'Queijo', priceCents: 400, available: true }, { id: 'o', name: 'Ovo', priceCents: 300, available: true }] }

describe('option selection', () => {
  it('swaps the choice in single-choice groups and keeps the required one selected', () => {
    let s = toggleOption(size, [], 's')
    s = toggleOption(size, s, 'd')
    expect(s).toEqual(['d'])
    expect(toggleOption(size, s, 'd')).toEqual(['d'])
  })

  it('caps multi-choice groups at the maximum and keeps other groups intact', () => {
    let s = toggleOption(size, [], 'd')
    s = toggleOption(extras, s, 'b')
    s = toggleOption(extras, s, 'q')
    expect(toggleOption(extras, s, 'o')).toEqual(s)
    expect(toggleOption(extras, s, 'b')).toEqual(['d', 'q'])
  })

  it('reports missing required choices and estimates the unit price', () => {
    expect(groupStatus([size, extras], [])[0].missing).toBe(1)
    expect(estimateUnit(3000, [size, extras], ['d', 'b'])).toBe(4700)
  })
})

describe('menu theme', () => {
  it('keeps text readable on any brand color', () => {
    for (const color of ['#FFE14D', '#16A36B', '#111827', '#F4F4F5']) {
      const vars = menuTheme(color, color) as Record<string, string>
      expect(contrastRatio(vars['--m-primary'], vars['--m-on-primary'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(vars['--m-ink'], '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    }
  })
})

const order = (status: OrderView['status']) => ({ status }) as OrderView

describe('kanban rules', () => {
  it('only accepts the next step or cancellation as drop targets', () => {
    expect(dropTarget(order('AWAITING_CONFIRMATION'), 'new')).toBe('NEW')
    expect(dropTarget(order('NEW'), 'preparing')).toBe('IN_PREPARATION')
    expect(dropTarget(order('NEW'), 'ready')).toBeNull()
    expect(dropTarget(order('READY'), 'cancelled')).toBe('CANCELLED')
    expect(dropTarget(order('COMPLETED'), 'cancelled')).toBeNull()
  })

  it('lets the kitchen run only kitchen steps', () => {
    const kitchen = ['ORDERS_VIEW', 'KITCHEN_OPERATE']
    expect(canRun(kitchen, 'NEW', 'IN_PREPARATION')).toBe(true)
    expect(canRun(kitchen, 'IN_PREPARATION', 'READY')).toBe(true)
    expect(canRun(kitchen, 'AWAITING_CONFIRMATION', 'NEW')).toBe(false)
    expect(canRun(kitchen, 'READY', 'DELIVERED')).toBe(false)
    expect(canRun(['ORDERS_MANAGE'], 'READY', 'DELIVERED')).toBe(true)
  })

  it('maps statuses to customer steps', () => {
    expect(stepIndex('COMPLETED')).toBe(stepIndex('DELIVERED'))
    expect(customerStatus('CANCELLED').label).toBe('Cancelado')
  })
})

describe('cart', () => {
  beforeEach(() => {
    localStorage.clear()
    useCart.setState({ token: null, lines: [] })
    useCart.getState().load('ABCD2345')
  })

  it('merges identical choices, keeps different notes apart and persists per table', () => {
    const add = useCart.getState().add
    const base = { productId: 'p', name: 'X-Bacon', optionIds: ['d', 'b'], optionNames: ['Duplo', 'Bacon'], notes: '', quantity: 1, unitPriceCents: 4700 }
    add(base)
    add({ ...base, optionIds: ['b', 'd'] })
    add({ ...base, notes: 'sem cebola' })
    const { lines } = useCart.getState()
    expect(lines).toHaveLength(2)
    expect(cartCount(lines)).toBe(3)
    expect(cartTotal(lines)).toBe(14100)
    expect(JSON.parse(localStorage.getItem('onecore.cart.ABCD2345') ?? '[]')).toHaveLength(2)
  })
})
