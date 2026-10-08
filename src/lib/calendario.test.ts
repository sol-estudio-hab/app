import { describe, expect, it } from 'vitest'
import {
  estadoActualAcuerdo,
  estadoDelMes,
  estadoDeposito,
  estadosMesesAcuerdo,
  formatearMes,
  generarMesesAcuerdo,
} from './calendario'
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

describe('estadoActualAcuerdo', () => {
  const hoy = new Date(2026, 6, 17) // 17 de julio de 2026

  function pagoDeMap(pagos: Record<string, Pago | undefined>) {
    return (mes: string) => pagos[mes]
  }

  it('devuelve null si el acuerdo no tiene meses', () => {
    expect(estadoActualAcuerdo([], pagoDeMap({}), hoy)).toBeNull()
  })

  it('devuelve "verificado" si todos los meses están verificados', () => {
    const meses = [
      { mes: '2026-05', vencimiento: new Date(2026, 4, 1) },
      { mes: '2026-06', vencimiento: new Date(2026, 5, 1) },
    ]
    const pagos = { '2026-05': pago('verificado'), '2026-06': pago('verificado') }
    expect(estadoActualAcuerdo(meses, pagoDeMap(pagos), hoy)).toBe('verificado')
  })

  it('un mes futuro que todavía no empieza no hace ver "pendiente" a alguien al día', () => {
    const meses = [
      { mes: '2026-06', vencimiento: new Date(2026, 5, 1) },
      { mes: '2026-07', vencimiento: new Date(2026, 6, 1) }, // mes actual, ya pagado
      { mes: '2026-08', vencimiento: new Date(2026, 7, 1) }, // aún no empieza, sin pago
    ]
    const pagos = { '2026-06': pago('verificado'), '2026-07': pago('verificado') }
    expect(estadoActualAcuerdo(meses, pagoDeMap(pagos), hoy)).toBe('verificado')
  })

  it('sin mora previa, refleja el estado normal del mes actual ("pendiente")', () => {
    const meses = [
      { mes: '2026-06', vencimiento: new Date(2026, 5, 1) },
      { mes: '2026-07', vencimiento: new Date(2026, 6, 20) },
    ]
    const pagos = { '2026-06': pago('verificado') }
    expect(estadoActualAcuerdo(meses, pagoDeMap(pagos), hoy)).toBe('pendiente')
  })

  it('mantiene "vencido" del mes anterior en vez de volver a "pendiente" al empezar el mes nuevo', () => {
    const meses = [
      { mes: '2026-06', vencimiento: new Date(2026, 5, 1) }, // sin pago, ya vencido
      { mes: '2026-07', vencimiento: new Date(2026, 6, 20) }, // aún no vence
    ]
    expect(estadoActualAcuerdo(meses, pagoDeMap({}), hoy)).toBe('vencido')
  })

  it('respeta un mes "en_revision" anterior aunque el mes actual esté pendiente', () => {
    const meses = [
      { mes: '2026-06', vencimiento: new Date(2026, 5, 1) },
      { mes: '2026-07', vencimiento: new Date(2026, 6, 20) },
    ]
    const pagos = { '2026-06': pago('cargado') }
    expect(estadoActualAcuerdo(meses, pagoDeMap(pagos), hoy)).toBe('en_revision')
  })
})

describe('estadosMesesAcuerdo (ingreso el día 25, septiembre pagado)', () => {
  const meses = generarMesesAcuerdo('2026-09-25', 4) // 25 sep, 25 oct, 25 nov, 25 dic
  const septiembrePagado = (mes: string) => (mes === '2026-09' ? pago('verificado') : undefined)

  function estadosEl(dia: number, mesIndice = 9) {
    return estadosMesesAcuerdo(meses, septiembrePagado, new Date(2026, mesIndice, dia))
  }

  it('hasta el 19 de octubre octubre se ve "Pagado" y los meses lejanos no tienen etiqueta', () => {
    expect(estadosEl(8)).toEqual(['verificado', 'verificado', null, null])
    expect(estadosEl(19)).toEqual(['verificado', 'verificado', null, null])
  })

  it('del 20 al 25 de octubre pasa a "Pendiente"', () => {
    expect(estadosEl(20)[1]).toBe('pendiente')
    expect(estadosEl(25)[1]).toBe('pendiente')
  })

  it('desde el 26 de octubre está "Vencido" (en mora)', () => {
    expect(estadosEl(26)[1]).toBe('vencido')
  })

  it('el primer mes sin pago nunca se ve "Pagado" aunque falte más de 5 días', () => {
    const estados = estadosMesesAcuerdo(meses, () => undefined, new Date(2026, 8, 1))
    expect(estados[0]).toBe('pendiente')
  })

  it('si el mes anterior está en revisión, el siguiente mes lejano no tiene etiqueta', () => {
    const enRevision = (mes: string) => (mes === '2026-09' ? pago('cargado') : undefined)
    const estados = estadosMesesAcuerdo(meses, enRevision, new Date(2026, 9, 8))
    expect(estados[0]).toBe('en_revision')
    expect(estados[1]).toBeNull()
  })

  it('un pago adelantado de octubre sigue verificado', () => {
    const adelantado = (mes: string) =>
      mes === '2026-09' || mes === '2026-10' ? pago('verificado') : undefined
    expect(estadosMesesAcuerdo(meses, adelantado, new Date(2026, 9, 8))).toEqual([
      'verificado',
      'verificado',
      'verificado',
      null,
    ])
  })

  it('el estado actual del acuerdo sigue el mismo calendario', () => {
    const pagoDeMes = septiembrePagado
    expect(estadoActualAcuerdo(meses, pagoDeMes, new Date(2026, 9, 8))).toBe('verificado')
    expect(estadoActualAcuerdo(meses, pagoDeMes, new Date(2026, 9, 19))).toBe('verificado')
    expect(estadoActualAcuerdo(meses, pagoDeMes, new Date(2026, 9, 20))).toBe('pendiente')
    expect(estadoActualAcuerdo(meses, pagoDeMes, new Date(2026, 9, 26))).toBe('vencido')
  })

  it('el mes vencido sigue en mora aunque ya empiece la ventana del mes siguiente', () => {
    // Octubre sin pagar, hoy 21 de noviembre: octubre vencido gana sobre noviembre pendiente.
    expect(estadoActualAcuerdo(meses, septiembrePagado, new Date(2026, 10, 21))).toBe('vencido')
  })
})

describe('estadoDeposito', () => {
  it('verificado se mantiene verificado', () => {
    expect(estadoDeposito('verificado')).toBe('verificado')
  })

  it('cargado es "en_revision"', () => {
    expect(estadoDeposito('cargado')).toBe('en_revision')
  })

  it('rechazado es "rechazado"', () => {
    expect(estadoDeposito('rechazado')).toBe('rechazado')
  })

  it('sin cargue (undefined) es "pendiente"', () => {
    expect(estadoDeposito(undefined)).toBe('pendiente')
  })

  it('estado "pendiente" explícito es "pendiente"', () => {
    expect(estadoDeposito('pendiente')).toBe('pendiente')
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
