import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, parseError } from './http'

afterEach(() => {
  vi.restoreAllMocks()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('parseError', () => {
  it('uses ProblemDetail detail and field errors', async () => {
    const res = new Response(JSON.stringify({ detail: 'Revise os campos', fields: { cnpj: 'CNPJ inválido' } }), { status: 400 })
    const error = await parseError(res)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('Revise os campos')
    expect(error.fields.cnpj).toBe('CNPJ inválido')
  })

  it('falls back to a friendly message for empty bodies', async () => {
    const error = await parseError(new Response(null, { status: 403 }))
    expect(error.message).toMatch(/permissão/)
  })
})

describe('api', () => {
  it('sends the CSRF cookie value as header on unsafe requests and includes credentials', async () => {
    document.cookie = 'XSRF-TOKEN=abc123; path=/'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await api('/auth/logout', { method: 'POST' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/logout')
    expect(init?.credentials).toBe('include')
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('abc123')
  })

  it('reports network failures as ApiError with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api('/auth/me')).rejects.toMatchObject({ status: 0 })
  })
})
