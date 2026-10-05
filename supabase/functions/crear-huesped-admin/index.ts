// Sol Estudio Hab — Edge Function: crear-huesped-admin
//
// Permite que un administrador cree la cuenta de un huésped que no se
// registró por su cuenta, para que igual le lleguen los recordatorios,
// avisos de basura y demás notificaciones (correo/WhatsApp; el push solo
// funciona cuando el huésped inicia sesión y lo activa en su dispositivo).
//
// Crea el usuario de autenticación ya confirmado y con una contraseña
// aleatoria que nadie conoce; el alta automática (trigger
// manejar_nuevo_usuario) crea el huésped y su acuerdo a partir de los
// metadatos. Opcionalmente envía un correo en español con un enlace para
// que el huésped establezca su contraseña y acceda a la app.
//
// Se despliega CON verificación de JWT (valor por defecto): la llamada
// debe traer la sesión de un usuario, y además aquí se comprueba que sea
// administrador (tabla `admins`).
//
// Requiere los secrets: RESEND_API_KEY, CORREO_REMITENTE (ya existen).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarCorreo } from '../_shared/correo.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const URL_APP = 'https://pagos.solestudiohab.com/'

// Misma lista que src/lib/habitaciones.ts
const HABITACIONES = ['101', '102', '103', '104', '105', '201', '202', '203', '204', '205', '206', '301']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Solicitud {
  correo?: string
  nombres?: string
  numeroHabitacion?: string
  fechaIngreso?: string
  mesesAcuerdo?: number
  numeroWhatsapp?: string
  enviarInvitacion?: boolean
}

function respuesta(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function error(mensaje: string, estado = 400): Response {
  return respuesta({ error: mensaje }, estado)
}

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return error('Método no permitido', 405)

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ----- Solo administradores -----
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return error('No autorizado', 401)
    const { data: datosUsuario, error: errorUsuario } = await supabase.auth.getUser(token)
    if (errorUsuario || !datosUsuario.user) return error('No autorizado', 401)
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', datosUsuario.user.id)
      .maybeSingle()
    if (!admin) return error('Solo un administrador puede crear huéspedes.', 403)

    // ----- Validación -----
    const cuerpo = (await req.json()) as Solicitud
    const correo = cuerpo.correo?.trim().toLowerCase() ?? ''
    const nombres = cuerpo.nombres?.trim() ?? ''
    const numeroHabitacion = cuerpo.numeroHabitacion?.trim() ?? ''
    const fechaIngreso = cuerpo.fechaIngreso?.trim() ?? ''
    const meses = Number(cuerpo.mesesAcuerdo)
    const numeroWhatsapp = cuerpo.numeroWhatsapp?.trim() ?? ''

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error('El correo no es válido.')
    if (!nombres) return error('Los nombres son obligatorios.')
    if (!HABITACIONES.includes(numeroHabitacion)) return error('Selecciona una habitación válida.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso) || Number.isNaN(Date.parse(fechaIngreso))) {
      return error('La fecha de ingreso no es válida.')
    }
    if (!Number.isInteger(meses) || meses <= 0 || meses > 120) {
      return error('El número de meses del acuerdo debe ser un entero entre 1 y 120.')
    }

    const { data: ocupadas } = await supabase.rpc('habitaciones_ocupadas')
    if (((ocupadas as string[] | null) ?? []).includes(numeroHabitacion)) {
      return error(`La habitación ${numeroHabitacion} ya tiene un acuerdo activo.`)
    }

    // ----- Alta del usuario (el trigger crea huésped + acuerdo) -----
    const metadatos: Record<string, string | number> = {
      nombres,
      numero_habitacion: numeroHabitacion,
      fecha_ingreso: fechaIngreso,
      meses_acuerdo: meses,
    }
    if (numeroWhatsapp) metadatos.numero_whatsapp = numeroWhatsapp

    const { data: creado, error: errorCrear } = await supabase.auth.admin.createUser({
      email: correo,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      email_confirm: true,
      user_metadata: metadatos,
    })
    if (errorCrear || !creado.user) {
      const yaExiste = /already|registered|exists/i.test(errorCrear?.message ?? '')
      console.error(errorCrear)
      return error(
        yaExiste
          ? 'Ya existe una cuenta con ese correo. Si es un huésped archivado, restáuralo desde su detalle.'
          : 'No se pudo crear el huésped.',
        yaExiste ? 409 : 500,
      )
    }

    // El trigger debió crear la fila del huésped; si no, no dejamos un usuario huérfano.
    const { data: huesped } = await supabase
      .from('huespedes')
      .select('id')
      .eq('id', creado.user.id)
      .maybeSingle()
    if (!huesped) {
      await supabase.auth.admin.deleteUser(creado.user.id)
      return error('No se pudo crear el huésped.', 500)
    }

    // ----- Invitación opcional para establecer contraseña -----
    let invitacionEnviada = false
    if (cuerpo.enviarInvitacion) {
      const { data: enlace } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: correo,
        options: { redirectTo: `${URL_APP}restablecer-contrasena` },
      })
      const accion = enlace?.properties?.action_link
      if (accion) {
        invitacionEnviada = await enviarCorreo({
          to: [correo],
          subject: 'Tu cuenta en Sol Estudio Hab',
          html: `<p>Hola ${escaparHtml(nombres)},</p>
                 <p>Creamos tu cuenta en la app de pagos de Sol Estudio Hab (habitación ${numeroHabitacion}). Desde ahí puedes subir tus comprobantes de pago y ver tus avisos.</p>
                 <p>Para empezar, establece tu contraseña con el siguiente botón (el enlace vence en 1 hora; si se vence, usa "¿Olvidaste tu contraseña?" en la app):</p>
                 <p style="margin-top:16px;">
                   <a href="${accion}" style="display:inline-block;background-color:#0f766e;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Establecer mi contraseña</a>
                 </p>`,
        })
      }
    }

    return respuesta({ id: creado.user.id, invitacionEnviada })
  } catch (excepcion) {
    console.error(excepcion)
    return error('Ocurrió un error inesperado.', 500)
  }
})
