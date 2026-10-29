// Sol Estudio Hab — Edge Function: firma-admin
//
// Firma del ARRENDADOR (propietario) cargada desde el panel: el administrador sube una imagen
// de la firma y se estampa en el mismo recuadro del PDF que se dibujó para el arrendador, igual
// que cuando un firmante firma desde su enlace. Se despliega CON verificación de JWT y además
// comprueba que quien llama sea administrador.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { exigirAdmin } from '../_shared/admin.ts'
import { CORS, ErrorFirma, UUID_RE, bytesDeFirmaPng, errorJson, firmarYRegistrar, json } from '../_shared/firmas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return errorJson('Método no permitido', 405)

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const admin = await exigirAdmin(req, supabase)
    if (admin instanceof Response) return admin

    const { firmanteId, firmaPng } = (await req.json()) as { firmanteId?: unknown; firmaPng?: unknown }
    if (typeof firmanteId !== 'string' || !UUID_RE.test(firmanteId)) return errorJson('Firmante inválido.')
    const png = bytesDeFirmaPng(firmaPng)
    if (!png) return errorJson('La imagen de la firma no es válida.')

    const { data: firmante } = await supabase
      .from('firma_firmantes')
      .select('id, contrato_id, rol, firmado_en')
      .eq('id', firmanteId)
      .maybeSingle()
    if (!firmante) return errorJson('Firmante no encontrado.', 404)
    if (firmante.rol !== 'arrendador') {
      return errorJson('Desde el panel solo se carga la firma del arrendador; los demás firman con su enlace.', 403)
    }
    if (firmante.firmado_en) return errorJson('Esta firma ya fue registrada.', 409)

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    const { completado } = await firmarYRegistrar(
      supabase,
      { id: firmante.id as string, contrato_id: firmante.contrato_id as string },
      png,
      ip,
    )
    return json({ ok: true, completado })
  } catch (excepcion) {
    if (excepcion instanceof ErrorFirma) return errorJson(excepcion.message, excepcion.estado)
    console.error(excepcion)
    return errorJson('No se pudo registrar la firma. Intenta de nuevo.', 500)
  }
})
