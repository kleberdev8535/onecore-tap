import { parseError } from '@/services/http'

/** Baixa um arquivo protegido da API (cookie de sessao) e dispara o download no navegador. */
export async function downloadFile(path: string, filename: string) {
  const response = await fetch(`/api${path}`, { credentials: 'include' })
  if (!response.ok) throw await parseError(response)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
