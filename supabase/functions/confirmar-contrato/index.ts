// Sol Estudio Hab — Edge Function: confirmar-contrato
//
// Enlace público que el huésped abre desde el correo del contrato para
// confirmar "Leí y acepto". Debe desplegarse con --no-verify-jwt porque
// se abre directo desde el correo, sin sesión de la app.
//
// Al confirmarse (solo la primera vez, es idempotente), le avisa por
// correo a todos los administradores registrados (tabla `admins`).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarCorreo } from '../_shared/correo.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function paginaHtml(mensaje: string): Response {
  return new Response(
    `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sol Estudio Hab</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#f8fafc;padding:40px 20px;text-align:center;">
  <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color:#0f766e;font-size:20px;margin-top:0;">Sol Estudio Hab</h1>
    <p style="color:#334155;font-size:15px;">${mensaje}</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

Deno.serve(async (req) => {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return paginaHtml('Enlace inválido: falta el identificador del contrato.')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: contrato, error: errorContrato } = await supabase
      .from('contratos')
      .select('id, huesped_id, nombre_archivo, confirmado_leido, confirmado_en, huespedes(nombres, numero_habitacion)')
      .eq('id', id)
      .single()

    if (errorContrato || !contrato) return paginaHtml('No encontramos ese contrato. Verifica el enlace del correo.')

    const huesped = contrato.huespedes as unknown as { nombres: string; numero_habitacion: string }

    if (contrato.confirmado_leido) {
      const fecha = contrato.confirmado_en ? new Date(contrato.confirmado_en).toLocaleString('es') : ''
      return paginaHtml(`Ya habías confirmado la lectura de este contrato el ${fecha}. ¡Gracias!`)
    }

    const ahora = new Date().toISOString()
    const { error: errorUpdate } = await supabase
      .from('contratos')
      .update({ confirmado_leido: true, confirmado_en: ahora })
      .eq('id', id)
    if (errorUpdate) throw new Error('No se pudo registrar la confirmación')

    const { data: admins } = await supabase.from('admins').select('correo')
    const correosAdmin = (admins ?? []).map((a: { correo: string }) => a.correo)

    if (correosAdmin.length > 0) {
      await enviarCorreo({
        to: correosAdmin,
        subject: `Contrato confirmado — ${huesped.nombres} (hab. ${huesped.numero_habitacion})`,
        html: `<p>${huesped.nombres} (habitación ${huesped.numero_habitacion}) confirmó que leyó y acepta su contrato
               "${contrato.nombre_archivo}".</p>
               <p>Fecha de confirmación: ${new Date(ahora).toLocaleString('es')}.</p>`,
      })
    }

    return paginaHtml('Gracias, tu confirmación de lectura y aceptación del contrato quedó registrada.')
  } catch (error) {
    console.error(error)
    return paginaHtml('Ocurrió un error registrando tu confirmación. Por favor contacta al administrador.')
  }
})
