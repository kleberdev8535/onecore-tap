import { useState } from 'react'
import { BellRing, ShoppingBag } from 'lucide-react'
import { contrastRatio, readableTextOn } from '@/utils/color'

interface MenuPreviewProps {
  tradeName: string
  primaryColor: string
  accentColor: string
  logoUrl?: string
  coverImageUrl?: string
  description?: string
}

/** Prévia ilustrativa do topo do cardápio no celular, com as cores e imagens do restaurante. */
export function MenuPreview({ tradeName, primaryColor: p, accentColor: a, logoUrl, coverImageUrl, description }: MenuPreviewProps) {
  const [brokenLogo, setBrokenLogo] = useState<string | null>(null)
  const [brokenCover, setBrokenCover] = useState<string | null>(null)
  const buttonText = readableTextOn(p)
  const headerText = readableTextOn(a)
  const showLogo = logoUrl && brokenLogo !== logoUrl
  const showCover = coverImageUrl && brokenCover !== coverImageUrl

  return (
    <div>
      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] border-[6px] border-ink bg-surface shadow-pop" aria-label="Prévia do cardápio">
        <div className="relative px-5 pb-6 pt-7" style={{ backgroundColor: a, color: headerText }}>
          {showCover && (
            <>
              <img src={coverImageUrl} alt="" className="absolute inset-0 size-full object-cover" onError={() => setBrokenCover(coverImageUrl)} />
              {/* Véu com a cor de apoio garante a leitura do nome sobre qualquer foto. */}
              <div className="absolute inset-0 opacity-75" style={{ backgroundColor: a }} aria-hidden />
            </>
          )}
          <div className="relative flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90 text-lg font-semibold" style={{ color: a }}>
              {showLogo ? <img src={logoUrl} alt="" className="size-full object-cover" onError={() => setBrokenLogo(logoUrl)} /> : tradeName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">{tradeName}</p>
              <p className="text-xs opacity-75">Mesa 05</p>
            </div>
          </div>
          {description && <p className="relative mt-3 line-clamp-2 text-xs leading-relaxed opacity-85">{description}</p>}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex gap-2">
            {['Lanches', 'Bebidas', 'Sobremesas'].map((c, i) => (
              <span key={c} className="rounded-full px-3 py-1 text-xs font-medium" style={i === 0 ? { backgroundColor: p, color: buttonText } : { backgroundColor: 'var(--color-surface-muted)', color: 'var(--color-fg-secondary)' }}>{c}</span>
            ))}
          </div>
          <div className="flex gap-3 rounded-xl border border-line p-3">
            <div className="size-16 shrink-0 rounded-lg bg-surface-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">Item de exemplo</p>
              <p className="text-xs text-muted">Descrição ilustrativa da prévia</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: contrastRatio(p, '#FFFFFF') >= 3 ? p : '#0B0F0E' }}>R$ 00,00</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: p, color: buttonText }}><ShoppingBag className="size-4" aria-hidden /> Ver pedido</span>
            <span className="flex size-11 items-center justify-center rounded-xl border border-line text-fg-secondary"><BellRing className="size-4" aria-hidden /></span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Conteúdo ilustrativo. O cardápio público chega na Fase 4.</p>
    </div>
  )
}
