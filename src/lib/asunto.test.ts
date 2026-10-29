import { describe, expect, it } from 'vitest'
import { asuntoAcuerdoFirmado, fechaCorta, nombreArchivoAcuerdo, primerNombre } from '../../supabase/functions/_shared/asunto'
import { ultimoDiaAcuerdo } from '../../supabase/functions/_shared/calendario'

describe('fechaCorta', () => {
  it('formatea día, mes abreviado en español y año de 2 dígitos', () => {
    expect(fechaCorta(new Date(2026, 8, 21))).toBe('21 Sep 26')
    expect(fechaCorta(new Date(2027, 4, 20))).toBe('20 May 27')
    expect(fechaCorta(new Date(2027, 0, 5))).toBe('5 Ene 27')
    expect(fechaCorta(new Date(2026, 7, 1))).toBe('1 Ago 26')
    expect(fechaCorta(new Date(2026, 11, 31))).toBe('31 Dic 26')
  })
})

describe('primerNombre', () => {
  it('toma solo la primera palabra', () => {
    expect(primerNombre('Leonel Alexander Gómez')).toBe('Leonel')
    expect(primerNombre('  Yaira   charlod ')).toBe('Yaira')
    expect(primerNombre('Sara')).toBe('Sara')
  })
})

describe('asuntoAcuerdoFirmado', () => {
  it('arma el asunto con el formato pedido (sin la "A")', () => {
    expect(
      asuntoAcuerdoFirmado({
        nombres: 'Leonel Gómez',
        habitacion: '105',
        inicio: new Date(2026, 8, 21),
        fin: new Date(2027, 4, 20),
      }),
    ).toBe('Acuerdo Firmado Leonel H105 21 Sep 26 - 20 May 27')
  })
})

describe('ultimoDiaAcuerdo', () => {
  it('21 sep 2026 con 8 meses termina el 20 de mayo de 2027 (el ejemplo del asunto)', () => {
    expect(fechaCorta(ultimoDiaAcuerdo('2026-09-21', 8))).toBe('20 May 27')
  })

  it('un acuerdo de 12 meses termina un día antes del aniversario', () => {
    expect(fechaCorta(ultimoDiaAcuerdo('2026-07-01', 12))).toBe('30 Jun 27')
  })

  it('cruza el fin de año y de mes correctamente', () => {
    expect(fechaCorta(ultimoDiaAcuerdo('2026-12-01', 1))).toBe('31 Dic 26')
  })
})

describe('nombreArchivoAcuerdo', () => {
  it('genera un nombre de archivo limpio', () => {
    expect(nombreArchivoAcuerdo('Leonel Gómez', '105')).toBe('Acuerdo Firmado Leonel H105.pdf')
  })

  it('elimina caracteres raros', () => {
    expect(nombreArchivoAcuerdo('Ana/../María', '2/01')).toBe('Acuerdo Firmado AnaMaría H201.pdf')
  })
})
