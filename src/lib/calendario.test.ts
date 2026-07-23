import { describe, expect, it } from 'vitest'
import { estadoDelMes, formatearMes, generarMesesAcuerdo } from './calendario'
import type { Pago } from '../types/dominio'

function pago(estado: Pago['estado']): Pago {
  return {
    id: 'p1',
    acuerdo_id: 'a1',
    mes_pagado: '2026-01',
    archivo_url: 'x',
    estado,
    fecha_carga: null,
    verificado_por: null,
    fecha_verificacion: null,
    observaciones: null,
  }
}

describe('generarMesesAcuerdo', () => {
  it('genera exactamente meses_acuerdo entradas, empezando en el mes de ingreso', () => {
    const meses = generarMesesAcuerdo('2026-06-01', 6)
    expect(meses).toHaveLength(6)
    expect(meses.map((m) => m.mes)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ])
  })

  it('conserva el día de vencimiento mes a mes', () => {
    const meses = generarMesesAcuerdo('2026-06-15', 3)
    expect(meses.map((m) => m.vencimiento.getDate())).toEqual([15, 15, 15])
  })

  it('recorta el día al último del mes cuando no existe (31 de enero -> 28/29 de febrero)', () => {
    const meses = generarMesesAcuerdo('2026-01-31', 3)
    // 2026 no es bisiesto: enero(31) -> febrero(28) -> marzo(31, vuelve al día original)
    expect(meses[0].vencimiento.getDate()).toBe(31)
    expect(meses[1].vencimiento.getDate()).toBe(28)
    expect(meses[1].mes).toBe('2026-02')
    expect(meses[2].vencimiento.getDate()).toBe(31)
  })

  it('respeta año bisiesto para el 31 de enero + 1 mes', () => {
    const meses = generarMesesAcuerdo('2028-01-31', 2)
    expect(meses[1].vencimiento.getDate()).toBe(29) // 2028 es bisiesto
  })

  it('devuelve arreglo vacío si meses_acuerdo es 0', () => {
    expect(generarMesesAcuerdo('2026-01-01', 0)).toHaveLength(0)
  })
})

describe('estadoDelMes', () => {
  const hoy = new Date(2026, 6, 17) // 17 de julio de 2026

  it('un pago verificado siempre es "verificado", sin importar la fecha', () => {
    const vencimientoFuturo = new Date(2026, 11, 1)
    expect(estadoDelMes(vencimientoFuturo, pago('verificado'), hoy)).toBe('verificado')
  })

  it('un pago cargado (sin verificar) es "en_revision"', () => {
    expect(estadoDelMes(new Date(2026, 5, 1), pago('cargado'), hoy)).toBe('en_revision')
  })

  it('un pago rechazado es "rechazado" aunque haya vencido', () => {
    expect(estadoDelMes(new Date(2026, 5, 1), pago('rechazado'), hoy)).toBe('rechazado')
  })

  it('sin pago y vencimiento futuro es "pendiente"', () => {
    expect(estadoDelMes(new Date(2026, 7, 1), undefined, hoy)).toBe('pendiente')
  })

  it('sin pago y vencimiento pasado es "vencido"', () => {
    expect(estadoDelMes(new Date(2026, 5, 1), undefined, hoy)).toBe('vencido')
  })

  it('el mismo día del vencimiento todavía cuenta como "pendiente" (no vencido)', () => {
    expect(estadoDelMes(new Date(2026, 6, 17), undefined, hoy)).toBe('pendiente')
  })

  it('un día después del vencimiento ya es "vencido"', () => {
    expect(estadoDelMes(new Date(2026, 6, 16), undefined, hoy)).toBe('vencido')
  })
})

describe('formatearMes', () => {
  it('formatea "2026-01" como "Enero de 2026"', () => {
    expect(formatearMes('2026-01')).toBe('Enero de 2026')
  })

  it('formatea "2026-12" como "Diciembre de 2026"', () => {
    expect(formatearMes('2026-12')).toBe('Diciembre de 2026')
  })
})
