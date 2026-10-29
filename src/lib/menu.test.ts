import { describe, expect, it } from 'vitest'
import { opcionesMenu } from './menu'

const titulos = (esAdmin: boolean, tieneHuesped: boolean) =>
  opcionesMenu({ esAdmin, tieneHuesped }).map((o) => o.titulo)

describe('opcionesMenu', () => {
  it('un huésped ve sus pagos, notificaciones y perfil', () => {
    expect(titulos(false, true)).toEqual(['Mis pagos', 'Notificaciones', 'Mi perfil'])
  })

  it('un administrador ve sus herramientas primero y luego lo personal', () => {
    expect(titulos(true, true)).toEqual([
      'Panel admin',
      'Nuevo huésped',
      'Firmas',
      'Reportes',
      'Mis pagos',
      'Notificaciones',
      'Mi perfil',
    ])
  })

  it('un administrador sin perfil de huésped no ve Mis pagos ni Notificaciones', () => {
    expect(titulos(true, false)).toEqual(['Panel admin', 'Nuevo huésped', 'Firmas', 'Reportes', 'Mi perfil'])
  })

  it('una cuenta sin perfil de huésped y sin ser admin igual ve Mis pagos (para crear su acuerdo)', () => {
    expect(titulos(false, false)).toEqual(['Mis pagos', 'Mi perfil'])
  })

  it('las rutas de las opciones son únicas', () => {
    const rutas = opcionesMenu({ esAdmin: true, tieneHuesped: true }).map((o) => o.to)
    expect(new Set(rutas).size).toBe(rutas.length)
  })
})
