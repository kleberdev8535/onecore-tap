import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/** Valor somente leitura com botao de copiar (links de convite, URLs de plaquinha). */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Copiado para a área de transferência.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-line bg-surface-muted">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[13px] text-fg-secondary outline-none"
      />
      <Button type="button" variant="ghost" className="h-auto rounded-none border-l border-line" onClick={copy} aria-label={`Copiar ${label}`}>
        {copied ? <Check className="text-brand" /> : <Copy />}
      </Button>
    </div>
  )
}
