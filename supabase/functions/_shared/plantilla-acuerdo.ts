// Cuerpo del correo que acompaña la copia del acuerdo firmado. Sin dependencias para poder
// probarlo con vitest (ver src/lib/plantillaAcuerdo.test.ts).
//
// Estructura de tablas con estilos en línea: es lo que se ve igual en Gmail, Outlook y demás
// clientes de correo, que ignoran o recortan las hojas de estilo normales.

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const VERDE = '#055741'
const DORADO = '#D4A437'
const CREMA = '#FAF3EB'

const PARRAFOS_INICIALES = [
  'En Sol Estudio HAB queremos darte la bienvenida a un espacio diseñado para brindarte tranquilidad, privacidad, comodidad y un ambiente de convivencia respetuoso y familiar.',
  'Nuestro propósito es ofrecerte mucho más que una habitación: queremos que encuentres un lugar donde te sientas a gusto, puedas concentrarte en tus estudios, trabajar por tus objetivos y avanzar hacia tus proyectos personales con la tranquilidad de contar con un entorno adecuado para tu bienestar.',
  'La convivencia es responsabilidad de todos. Por eso, te invitamos a conocer, comprender y poner en práctica nuestros acuerdos de convivencia. Estas pautas nos permiten mantener un ambiente organizado, respetuoso y agradable, en el que cada residente pueda disfrutar de su espacio y, al mismo tiempo, contribuir al bienestar colectivo.',
  'Entendemos que detrás de cada estudiante hay sueños, esfuerzos, responsabilidades y una familia que confía en su futuro. Por ello, trabajamos cada día para ofrecer un espacio juvenil, seguro, privado, cómodo y funcional, con las condiciones necesarias para que tu estancia sea satisfactoria.',
]

const PARRAFO_FINAL =
  'Te deseamos una excelente experiencia en Sol Estudio HAB y muchos éxitos en esta etapa de tu vida.'

const PARRAFO_ADJUNTO = 'Adjuntamos la copia de tu acuerdo firmado.'

function parrafo(texto: string): string {
  return `<p style="margin:0 0 16px;">${escaparHtml(texto)}</p>`
}

/** Correo de bienvenida del acuerdo firmado. `nombre` es el primer nombre del estudiante. */
export function plantillaAcuerdoFirmado({ habitacion, nombre }: { habitacion: string; nombre: string }): string {
  const cuerpo = [
    ...PARRAFOS_INICIALES.map(parrafo),
    parrafo(
      `${nombre}, queremos que sientas este lugar como tu hogar. Te invitamos a cuidarlo, respetarlo y contribuir a mantenerlo en las mejores condiciones. Con el compromiso de todos, podemos construir una convivencia basada en el respeto, la tranquilidad y la consideración mutua.`,
    ),
    parrafo(PARRAFO_FINAL),
    parrafo(PARRAFO_ADJUNTO),
  ].join('\n')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CREMA};padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
            <tr>
              <td style="background-color:${VERDE};padding:22px 28px;border-bottom:4px solid ${DORADO};">
                <span style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:bold;">Habitación ${escaparHtml(habitacion)} | Sol Estudio HAB</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.65;">
                ${cuerpo}
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold;color:${VERDE};">¡Bienvenido a tu hogar!</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}
