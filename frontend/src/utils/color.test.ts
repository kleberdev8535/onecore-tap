import { describe, expect, it } from 'vitest'
import { contrastLevel, contrastRatio, isHexColor, readableTextOn } from './color'

describe('color', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })

  it('picks a readable text color for any brand color', () => {
    expect(readableTextOn('#16A36B')).toBe('#0B0F0E')
    expect(readableTextOn('#0D694A')).toBe('#FFFFFF')
    expect(readableTextOn('#FFE600')).toBe('#0B0F0E')
    expect(readableTextOn('#1E3A8A')).toBe('#FFFFFF')
  })

  it('classifies contrast and validates hex', () => {
    expect(contrastLevel(7)).toBe('AA')
    expect(contrastLevel(3.2)).toBe('AA grande')
    expect(contrastLevel(1.5)).toBe('Insuficiente')
    expect(isHexColor('#16a36b')).toBe(true)
    expect(isHexColor('16a36b')).toBe(false)
  })
})
