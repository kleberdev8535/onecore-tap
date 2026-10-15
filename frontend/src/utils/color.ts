/**
 * Utilitarios de contraste (WCAG 2.x). Garantem legibilidade mesmo quando o restaurante escolhe cores ruins:
 * o texto sobre a cor da marca e escolhido automaticamente entre branco e o preto da OneCore.
 */

const INK = '#0B0F0E'
const WHITE = '#FFFFFF'

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function channel(c: number) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Cor de texto mais legivel sobre o fundo informado. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK
}

/** Classificacao para exibir ao Super Admin: AA exige 4.5:1 para texto normal. */
export function contrastLevel(ratio: number): 'AA' | 'AA grande' | 'Insuficiente' {
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA grande'
  return 'Insuficiente'
}
