import { describe, expect, it } from 'vitest'
import { diaDePago, mesesTranscurridos } from './fechas'

describe('diaDePago', () => {
  it('extrae el día del mes de la fecha de ingreso', () => {
    expect(diaDePago('2026-06-15')).toBe(15)
    expect(diaDePago('2026-01-01')).toBe(1)
    expect(diaDePago('2026-06-30')).toBe(30)
  })
})

describe('mesesTranscurridos', () => {
  it('devuelve 0 el mismo día de ingreso', () => {
    expect(mesesTranscurridos('2026-06-01', new Date(2026, 5, 1))).toBe(0)
  })

  it('cuenta un mes completo tras cumplirse el día de vencimiento del mes siguiente', () => {
    expect(mesesTranscurridos('2026-06-01', new Date(2026, 6, 1))).toBe(1)
  })

  it('no cuenta el mes en curso hasta que se cumpla el día de ingreso', () => {
    // Ingreso el 15; hoy es el 10 del mes siguiente: aún no se cumple el ciclo.
    expect(mesesTranscurridos('2026-06-15', new Date(2026, 6, 10))).toBe(0)
  })

  it('nunca devuelve un número negativo (fecha de ingreso en el futuro)', () => {
    expect(mesesTranscurridos('2026-12-01', new Date(2026, 5, 1))).toBe(0)
  })
})
