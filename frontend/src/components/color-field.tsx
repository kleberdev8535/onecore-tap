import { useId } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { contrastLevel, contrastRatio, readableTextOn } from '@/utils/color'

export function ColorField({ label, hint, value, onChange, valid }: { label: string; hint: string; value: string; onChange: (v: string) => void; valid: boolean }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-fg-secondary">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" aria-label={`${label}: seletor`} value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-10 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1" />
        <Input id={id} value={value} invalid={!valid} aria-describedby={`${id}-hint`} onChange={(e) => onChange(e.target.value.toUpperCase())} maxLength={7} className="font-mono uppercase" />
      </div>
      <p id={`${id}-hint`} className={valid ? 'text-xs text-muted' : 'text-xs font-medium text-danger'}>{valid ? hint : 'Use o formato #RRGGBB'}</p>
    </div>
  )
}

/** Avisa quando a cor principal deixa o texto dos botões pouco legível. */
export function ContrastNotice({ color }: { color: string }) {
  const ratio = contrastRatio(color, readableTextOn(color))
  const level = contrastLevel(ratio)
  const weak = level === 'Insuficiente'
  return (
    <div className={weak ? 'flex gap-2.5 rounded-lg bg-warning-soft px-3.5 py-3 text-[13px] text-warning' : 'flex gap-2.5 rounded-lg bg-success-soft px-3.5 py-3 text-[13px] text-success'}>
      {weak ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>
        Contraste do texto nos botões: <strong className="tabular">{ratio.toFixed(1)}:1</strong> ({level}).
        {weak ? ' A cor principal fica pouco legível. Escolha um tom mais escuro ou mais claro.' : ' O texto se ajusta automaticamente entre branco e preto.'}
      </span>
    </div>
  )
}
