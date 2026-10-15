import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Nfc, ScanLine } from 'lucide-react'

/**
 * Representacao da plaquinha física aprovada: acrilico preto, QR Code a esquerda, NFC a direita,
 * "Escaneie" / "Aproxime" e a mesa na base. O QR e um padrão ilustrativo (não codifica URL real).
 */
export function PlaqueIllustration({ table = '05' }: { table?: string }) {
  const reduce = useReducedMotion()
  const cells = useMemo(() => qrPattern(21), [])

  return (
    <div className="relative w-full max-w-[420px]" aria-hidden>
      {/* Halo verde atras da placa */}
      <div className="absolute -inset-10 rounded-[48px] bg-[radial-gradient(closest-side,rgb(22_163_107/0.28),transparent)]" />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        style={{ transformPerspective: 1200 }}
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,#1a2220_0%,#0b0f0e_45%,#070a09_100%)] p-6 shadow-[0_40px_80px_-24px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.08)]"
      >
        {/* Reflexo do acrilico */}
        <div className="pointer-events-none absolute -left-1/4 -top-1/2 h-full w-[150%] rotate-[-18deg] bg-gradient-to-b from-white/[0.07] to-transparent" />

        <div className="relative flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-tight text-white">
            OneCore <span className="text-brand">Tap</span>
          </span>
          <span className="h-1.5 w-8 rounded-full bg-brand" />
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-2.5">
              <svg viewBox="0 0 21 21" className="size-[112px]" shapeRendering="crispEdges">
                {cells.map(([x, y]) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0B0F0E" />
                ))}
              </svg>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-white/80">
              <ScanLine className="size-3.5 text-brand" /> Escaneie
            </span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative flex size-[132px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
              {!reduce &&
                [0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute size-16 rounded-full border border-brand/50"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1.9, opacity: [0, 0.7, 0] }}
                    transition={{ duration: 2.6, repeat: 3, delay: 1 + i * 0.85, ease: 'easeOut' }}
                  />
                ))}
              <Nfc className="relative size-12 text-white" strokeWidth={1.5} />
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-white/80">
              <Nfc className="size-3.5 text-brand" /> Aproxime
            </span>
          </div>
        </div>

        <div className="relative mt-6 flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">Mesa</span>
          <span className="ml-2 text-lg font-semibold tabular text-white">{table}</span>
        </div>
      </motion.div>
    </div>
  )
}

/** Padrão deterministico com os tres marcadores de posicao de um QR Code, apenas para ilustracao. */
function qrPattern(size: number): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
        if (edge || core) cells.push([ox + x, oy + y])
      }
  }
  finder(0, 0)
  finder(size - 7, 0)
  finder(0, size - 7)
  let seed = 7
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const inFinder = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9)
      if (!inFinder && rand() > 0.52) cells.push([x, y])
    }
  return cells
}
