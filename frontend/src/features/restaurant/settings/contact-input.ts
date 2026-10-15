import type { RestaurantSettings } from '@/types/api'
import type { ContactInput } from '../api'

/**
 * O endpoint de contato substitui todos os campos de uma vez; as telas que alteram só uma parte partem dos valores
 * atuais para não apagar o restante.
 */
export function contactFrom(s: RestaurantSettings, changes: Partial<ContactInput>): ContactInput {
  const base: ContactInput = {
    email: s.email ?? undefined,
    phone: s.phone ?? undefined,
    addressLine: s.addressLine ?? undefined,
    city: s.city ?? undefined,
    state: s.state ?? undefined,
    postalCode: s.postalCode ?? undefined,
    description: s.description ?? undefined,
  }
  const merged = { ...base, ...changes }
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v === '' ? undefined : v])) as ContactInput
}
