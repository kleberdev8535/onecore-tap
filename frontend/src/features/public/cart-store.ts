import { create } from 'zustand'

export interface CartLine {
  /** Mesma combinação de produto + opções + observação vira uma única linha. */
  key: string
  productId: string
  name: string
  optionIds: string[]
  optionNames: string[]
  notes: string
  quantity: number
  /** Estimativa para exibição; o valor final é sempre calculado pelo servidor. */
  unitPriceCents: number
}

interface CartState {
  token: string | null
  lines: CartLine[]
  load: (token: string) => void
  add: (line: Omit<CartLine, 'key'>) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

const storageKey = (token: string) => `onecore.cart.${token}`

function persist(token: string | null, lines: CartLine[]) {
  if (!token) return
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(lines))
  } catch {
    // sem armazenamento: o carrinho vale só nesta aba
  }
}

export const lineKey = (productId: string, optionIds: string[], notes: string) =>
  `${productId}|${[...optionIds].sort().join(',')}|${notes.trim().toLowerCase()}`

/** Carrinho por mesa (token da plaquinha), guardado só neste aparelho. */
export const useCart = create<CartState>((set, get) => ({
  token: null,
  lines: [],
  load: (token) => {
    if (get().token === token) return
    let lines: CartLine[] = []
    try {
      const raw = localStorage.getItem(storageKey(token))
      lines = raw ? (JSON.parse(raw) as CartLine[]) : []
    } catch {
      lines = []
    }
    set({ token, lines: Array.isArray(lines) ? lines : [] })
  },
  add: (line) => {
    const key = lineKey(line.productId, line.optionIds, line.notes)
    const lines = [...get().lines]
    const existing = lines.find((l) => l.key === key)
    if (existing) existing.quantity = Math.min(50, existing.quantity + line.quantity)
    else lines.push({ ...line, key })
    persist(get().token, lines)
    set({ lines })
  },
  setQuantity: (key, quantity) => {
    const lines = get()
      .lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l))
      .filter((l) => l.quantity > 0)
    persist(get().token, lines)
    set({ lines })
  },
  remove: (key) => {
    const lines = get().lines.filter((l) => l.key !== key)
    persist(get().token, lines)
    set({ lines })
  },
  clear: () => {
    persist(get().token, [])
    set({ lines: [] })
  },
}))

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0)
export const cartTotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0)
