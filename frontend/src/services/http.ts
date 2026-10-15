/**
 * Cliente HTTP da API OneCore Tap.
 *
 * - Sessão por cookie HttpOnly (nunca guardamos token em localStorage).
 * - Proteção CSRF: o backend grava o cookie XSRF-TOKEN; reenviamos o valor no header X-XSRF-TOKEN
 *   em toda requisicao que altera estado.
 * - Erros chegam como ProblemDetail (RFC 9457) e viram ApiError.
 */

const API_BASE = '/api'
const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class ApiError extends Error {
  readonly status: number
  readonly fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

let csrfBootstrap: Promise<void> | null = null

async function ensureCsrfCookie() {
  if (readCookie(CSRF_COOKIE)) return
  csrfBootstrap ??= fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
    .then(() => undefined)
    .finally(() => {
      csrfBootstrap = null
    })
  await csrfBootstrap
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Não encontramos o que você procurava.',
  429: 'Muitas tentativas. Aguarde alguns minutos.',
}

export async function parseError(response: Response): Promise<ApiError> {
  let detail: string | undefined
  let fields: Record<string, string> = {}
  try {
    const body = await response.json()
    detail = typeof body?.detail === 'string' ? body.detail : undefined
    if (body?.fields && typeof body.fields === 'object') fields = body.fields
  } catch {
    // corpo vazio ou nao-JSON
  }
  const message =
    detail ?? FALLBACK_MESSAGES[response.status] ?? 'Não foi possível concluir a ação. Tente novamente.'
  return new ApiError(response.status, message, fields)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  if (UNSAFE_METHODS.has(method)) {
    await ensureCsrfCookie()
    const token = readCookie(CSRF_COOKIE)
    if (token) headers.set(CSRF_HEADER, token)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, method, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet e tente novamente.')
  }

  if (!response.ok) throw await parseError(response)
  if (response.status === 204 || response.headers.get('Content-Length') === '0') return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const http = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body?: unknown) =>
    api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T = void>(path: string) => api<T>(path, { method: 'DELETE' }),
}
