import { describe, expect, it } from 'vitest'
import type { Me, Role } from '@/types/api'
import { homePathFor, safeNextPath } from './home-path'

const me = (role: Role): Me => ({ id: '1', name: 'Ana', email: 'a@a.dev', role, permissions: [], restaurant: null, modules: [] })

describe('homePathFor', () => {
  it('sends each role to its panel', () => {
    expect(homePathFor(me('SUPER_ADMIN'))).toBe('/admin')
    expect(homePathFor(me('RESTAURANT_OWNER'))).toBe('/app')
    expect(homePathFor(me('KITCHEN'))).toBe('/app/cozinha')
  })
})

describe('safeNextPath', () => {
  it('blocks open redirects', () => {
    expect(safeNextPath('https://malicioso.com', me('SUPER_ADMIN'))).toBe('/admin')
    expect(safeNextPath('//malicioso.com', me('SUPER_ADMIN'))).toBe('/admin')
  })

  it('keeps internal paths allowed for the role', () => {
    expect(safeNextPath('/admin/restaurantes', me('SUPER_ADMIN'))).toBe('/admin/restaurantes')
    expect(safeNextPath('/app', me('WAITER'))).toBe('/app')
  })

  it('does not send restaurant staff into the admin area', () => {
    expect(safeNextPath('/admin', me('RESTAURANT_OWNER'))).toBe('/app')
    expect(safeNextPath('/app', me('SUPER_ADMIN'))).toBe('/admin')
  })
})
