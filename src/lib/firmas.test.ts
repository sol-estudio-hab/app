import { describe, expect, it } from 'vitest'
import {
  campoARectPantalla,
  enlaceFirma,
  limitarRect,
  mensajeWhatsappFirma,
  rectEntrePuntos,
  rectPantallaACampo,
} from './firmas'

describe('conversión pantalla ↔ PDF', () => {
  const altoPagina = 842 // A4

  it('una casilla pegada abajo-izquierda del PDF queda abajo-izquierda en pantalla', () => {
    const rect = campoARectPantalla({ x: 0, y: 0, ancho: 100, alto: 50 }, 1, altoPagina)
    expect(rect).toEqual({ left: 0, top: 792, width: 100, height: 50 })
  })

  it('aplica la escala del visor', () => {
    const rect = campoARectPantalla({ x: 60, y: 100, ancho: 200, alto: 60 }, 1.5, altoPagina)
    expect(rect.left).toBeCloseTo(90)
    expect(rect.width).toBeCloseTo(300)
    expect(rect.height).toBeCloseTo(90)
    expect(rect.top).toBeCloseTo((842 - 100 - 60) * 1.5)
  })

  it('pantalla → PDF → pantalla devuelve el mismo rectángulo', () => {
    const original = { left: 37, top: 400, width: 180, height: 55 }
    const escala = 0.8
    const campo = rectPantallaACampo(original, escala, altoPagina)
    const vuelta = campoARectPantalla(campo, escala, altoPagina)
    expect(vuelta.left).toBeCloseTo(original.left)
    expect(vuelta.top).toBeCloseTo(original.top)
    expect(vuelta.width).toBeCloseTo(original.width)
    expect(vuelta.height).toBeCloseTo(original.height)
  })

  it('el origen del PDF es abajo: un rectángulo arriba en pantalla tiene y grande en el PDF', () => {
    const campo = rectPantallaACampo({ left: 0, top: 0, width: 100, height: 40 }, 1, altoPagina)
    expect(campo.y).toBe(802)
  })
})

describe('rectEntrePuntos', () => {
  it('normaliza el arrastre en cualquier dirección', () => {
    expect(rectEntrePuntos(100, 80, 40, 20)).toEqual({ left: 40, top: 20, width: 60, height: 60 })
    expect(rectEntrePuntos(40, 20, 100, 80)).toEqual({ left: 40, top: 20, width: 60, height: 60 })
  })
})

describe('limitarRect', () => {
  it('recorta lo que se sale de la página', () => {
    const r = limitarRect({ left: 500, top: 700, width: 200, height: 300 }, 600, 800)
    expect(r).toEqual({ left: 500, top: 700, width: 100, height: 100 })
  })

  it('no permite posiciones negativas', () => {
    const r = limitarRect({ left: -10, top: -5, width: 50, height: 50 }, 600, 800)
    expect(r.left).toBe(0)
    expect(r.top).toBe(0)
  })
})

describe('enlaces y mensaje de WhatsApp', () => {
  const token = '123e4567-e89b-42d3-a456-426614174000'

  it('arma el enlace de firma sin dobles barras', () => {
    expect(enlaceFirma(token, 'https://firmas.solestudiohab.com/')).toBe(
      `https://firmas.solestudiohab.com/firmar?t=${token}`,
    )
  })

  it('arma el mensaje con nombre, habitación y enlace', () => {
    expect(mensajeWhatsappFirma('Ana', '105', 'https://x.co/firmar?t=1')).toBe(
      'Hola Ana, firma tu acuerdo de arrendamiento de la habitación 105 aquí: https://x.co/firmar?t=1',
    )
  })

  it('omite la habitación cuando no hay', () => {
    expect(mensajeWhatsappFirma('Ana', null, 'https://x.co')).toBe(
      'Hola Ana, firma tu acuerdo de arrendamiento aquí: https://x.co',
    )
  })
})
