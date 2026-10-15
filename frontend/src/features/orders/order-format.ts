import { useEffect, useState } from 'react'

export const orderNumber = (n: number) => `#${String(n).padStart(4, '0')}`

/** Relógio compartilhado para "há X min" sem re-renderizar a cada segundo. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
