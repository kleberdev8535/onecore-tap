import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'octap.sidebar.collapsed'

function readInitial(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Preferencia local de sidebar recolhida (apenas conveniencia visual). Atalho: tecla "[". */
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(readInitial)

  const toggle = useCallback(() => setCollapsed((v) => !v), [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // armazenamento indisponível: segue so em memoria
    }
  }, [collapsed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (event.key === '[' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return { collapsed, toggle }
}
