// Sol Estudio Hab — Edge Function: firma-copia
//
// Acción del administrador sobre un contrato de firma COMPLETADO:
//  - { contratoId }                → vincula el contrato al huésped (si ya existe) y envía la copia
//                                    firmada solo si todavía no se había enviado.
//  - { contratoId, forzar: true }  → envía (o reenvía) la copia firmada ahora.
// El correo solo sale si el huésped ya tiene su estadía (acuerdo) en el sistema, porque el asunto
// lleva las fechas del periodo. Se despliega CON verificación de JWT y comprueba que sea admin.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { exigirAdmin } from '../_shared/admin.ts'
import { alCompletar, type MotivoSinEnvio } from '../_shared/firmas-correo.ts'
import { CORS, UUID_RE, errorJson, json } from '../_shared/firmas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MENSAJE_POR_MOTIVO: Record<MotivoSinEnvio, string> = {
  no_completado: 'Todavía faltan firmas en este contrato.',
  sin_huesped:
    'Este contrato no está vinculado a un huésped. Vincúlalo a un huésped que ya exista y vuelve a intentarlo.',
  sin_acuerdo:
    'El huésped todavía no tiene su estadía (acuerdo) registrada en el sistema, y de ahí salen las fechas del asunto. Cuando la registres, vuelve a enviar la copia.',
  ya_enviado: 'La copia ya se había enviado.',
  error_envio: 'No se pudo enviar el correo. Intenta de nuevo.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return errorJson('Método no permitido', 405)

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const admin = await exigirAdmin(req, supabase)
    if (admin instanceof Response) return admin

    const { contratoId, forzar } = (await req.json()) as { contratoId?: unknown; forzar?: unknown }
    if (typeof contratoId !== 'string' || !UUID_RE.test(contratoId)) return errorJson('Contrato inválido.')

    const resultado = await alCompletar(supabase, contratoId, { forzarEnvio: forzar === true })

    // Si el admin pidió enviar y no salió, se le explica por qué.
    if (forzar === true && !resultado.envio.enviado) {
      return errorJson(MENSAJE_POR_MOTIVO[resultado.envio.motivo ?? 'error_envio'], 409)
    }
    return json({ ...resultado, mensaje: resultado.envio.motivo ? MENSAJE_POR_MOTIVO[resultado.envio.motivo] : null })
  } catch (excepcion) {
    console.error(excepcion)
    return errorJson('Ocurrió un error inesperado.', 500)
  }
})
