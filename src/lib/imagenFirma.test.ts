import { describe, expect, it } from 'vitest'
import { alfaDesdeContraste } from './imagenFirma'

describe('alfaDesdeContraste', () => {
  it('lo que apenas difiere del fondo (papel, sombras suaves) queda transparente', () => {
    expect(alfaDesdeContraste(0)).toBe(0)
    expect(alfaDesdeContraste(-30)).toBe(0) // más claro que su fondo
    expect(alfaDesdeContraste(20)).toBe(0)
  })

  it('lo claramente más oscuro que el fondo es tinta opaca', () => {
    expect(alfaDesdeContraste(95)).toBe(255)
    expect(alfaDesdeContraste(180)).toBe(255)
  })

  it('los tonos intermedios se mezclan de forma gradual y creciente', () => {
    const poco = alfaDesdeContraste(40)
    const medio = alfaDesdeContraste(60)
    const mucho = alfaDesdeContraste(85)
    expect(poco).toBeGreaterThan(0)
    expect(medio).toBeGreaterThan(poco)
    expect(mucho).toBeGreaterThan(medio)
    expect(mucho).toBeLessThan(255)
  })
})
