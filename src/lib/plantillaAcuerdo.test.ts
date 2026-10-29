import { describe, expect, it } from 'vitest'
import { escaparHtml, plantillaAcuerdoFirmado } from '../../supabase/functions/_shared/plantilla-acuerdo'

// Texto aprobado por la administración: no se cambia ninguna palabra.
const PARRAFOS_APROBADOS = [
  'En Sol Estudio HAB queremos darte la bienvenida a un espacio diseñado para brindarte tranquilidad, privacidad, comodidad y un ambiente de convivencia respetuoso y familiar.',
  'Nuestro propósito es ofrecerte mucho más que una habitación: queremos que encuentres un lugar donde te sientas a gusto, puedas concentrarte en tus estudios, trabajar por tus objetivos y avanzar hacia tus proyectos personales con la tranquilidad de contar con un entorno adecuado para tu bienestar.',
  'La convivencia es responsabilidad de todos. Por eso, te invitamos a conocer, comprender y poner en práctica nuestros acuerdos de convivencia. Estas pautas nos permiten mantener un ambiente organizado, respetuoso y agradable, en el que cada residente pueda disfrutar de su espacio y, al mismo tiempo, contribuir al bienestar colectivo.',
  'Entendemos que detrás de cada estudiante hay sueños, esfuerzos, responsabilidades y una familia que confía en su futuro. Por ello, trabajamos cada día para ofrecer un espacio juvenil, seguro, privado, cómodo y funcional, con las condiciones necesarias para que tu estancia sea satisfactoria.',
  'Leonel, queremos que sientas este lugar como tu hogar. Te invitamos a cuidarlo, respetarlo y contribuir a mantenerlo en las mejores condiciones. Con el compromiso de todos, podemos construir una convivencia basada en el respeto, la tranquilidad y la consideración mutua.',
  'Te deseamos una excelente experiencia en Sol Estudio HAB y muchos éxitos en esta etapa de tu vida.',
  'Adjuntamos la copia de tu acuerdo firmado.',
]

describe('plantillaAcuerdoFirmado', () => {
  const html = plantillaAcuerdoFirmado({ habitacion: '105', nombre: 'Leonel' })

  it('incluye el título con la habitación', () => {
    expect(html).toContain('Habitación 105 | Sol Estudio HAB')
  })

  it('incluye cada párrafo aprobado, sin cambios, y en el mismo orden', () => {
    let posicion = -1
    for (const texto of PARRAFOS_APROBADOS) {
      const encontrado = html.indexOf(texto)
      expect(encontrado, `falta o cambió: ${texto.slice(0, 40)}…`).toBeGreaterThan(posicion)
      posicion = encontrado
    }
  })

  it('cierra con "¡Bienvenido a tu hogar!"', () => {
    expect(html).toContain('¡Bienvenido a tu hogar!')
    expect(html.indexOf('¡Bienvenido a tu hogar!')).toBeGreaterThan(html.indexOf(PARRAFOS_APROBADOS[6]))
  })

  it('usa el nombre y la habitación que se le pasan', () => {
    const otro = plantillaAcuerdoFirmado({ habitacion: '201', nombre: 'Sara' })
    expect(otro).toContain('Habitación 201 | Sol Estudio HAB')
    expect(otro).toContain('Sara, queremos que sientas este lugar como tu hogar.')
    expect(otro).not.toContain('Leonel')
  })

  it('escapa el HTML del nombre y la habitación', () => {
    const peligroso = plantillaAcuerdoFirmado({ habitacion: '<b>1</b>', nombre: '<script>x</script>' })
    expect(peligroso).not.toContain('<script>')
    expect(peligroso).not.toContain('<b>1</b>')
    expect(peligroso).toContain('&#60;script&#62;')
  })
})

describe('escaparHtml', () => {
  it('escapa los caracteres especiales', () => {
    expect(escaparHtml(`<a href="x">&'</a>`)).toBe('&#60;a href=&#34;x&#34;&#62;&#38;&#39;&#60;/a&#62;')
  })
})
