// Sol Estudio Hab — Edge Function: firma-enviar
//
// Recibe la firma de un firmante (imagen PNG dibujada en su celular), la estampa
// en el servidor sobre el PDF y registra la firma. Se despliega con
// --no-verify-jwt: el token (UUID impredecible, uno por firmante) es la credencial.
//
// La lógica de estampado, control de concurrencia y cierre del contrato (vincular al
// huésped y enviar la copia firmada) vive en _shared/firmas.ts (firmarYRegistrar), que
// también usa firma-admin para la firma del arrendador cargada desde el panel.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { CORS, ErrorFirma, UUID_RE, bytesDeFirmaPng, errorJson, firmarYRegistrar, json } from '../_shared/firmas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Solicitud {
  token?: unknown
  firmaPng?: unknown
  acepto?: unknown
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return errorJson('Método no permitido', 405)

  try {
    const { token, firmaPng, acepto } = (await req.json()) as Solicitud

    if (typeof token !== 'string' || !UUID_RE.test(token)) return errorJson('Enlace inválido o vencido', 404)
    if (acepto !== true) return errorJson('Debes aceptar el acuerdo para firmar.')
    const png = bytesDeFirmaPng(firmaPng)
    if (!png) return errorJson('La firma no es válida. Dibújala de nuevo.')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: firmante, error: errorBusqueda } = await supabase
      .from('firma_firmantes')
      .select('id, contrato_id, firmado_en')
      .eq('token', token)
      .maybeSingle()
    // Un fallo técnico no es un enlace inválido: se pide reintentar en vez de asustar al firmante.
    if (errorBusqueda) {
      console.error(errorBusqueda)
      return errorJson('No se pudo procesar tu solicitud. Intenta de nuevo en unos segundos.', 503)
    }
    if (!firmante) return errorJson('Enlace inválido o vencido', 404)
    if (firmante.firmado_en) return errorJson('Este documento ya fue firmado.', 409)

    const ip =
      req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

    const { urlPdf } = await firmarYRegistrar(
      supabase,
      { id: firmante.id as string, contrato_id: firmante.contrato_id as string },
      png,
      ip,
    )
    return json({ ok: true, urlPdf })
  } catch (excepcion) {
    if (excepcion instanceof ErrorFirma) return errorJson(excepcion.message, excepcion.estado)
    console.error(excepcion)
    return errorJson('No se pudo registrar tu firma. Intenta de nuevo.', 500)
  }
})
