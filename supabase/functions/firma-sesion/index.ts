// Sol Estudio Hab — Edge Function: firma-sesion
//
// Entrada pública de la pantalla de firma (/firmar?t=<token>). Recibe el token
// del firmante y devuelve lo necesario para mostrar el documento: título,
// nombre y rol del firmante, sus casillas de firma y una URL firmada temporal
// (15 min) para leer el PDF. Si el firmante ya firmó, devuelve `yaFirmado` y
// la URL del PDF firmado para que descargue su copia.
//
// Se despliega con --no-verify-jwt: el firmante no tiene sesión; el token
// (UUID impredecible, uno por firmante) es la credencial.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { CORS, SEGUNDOS_URL_PDF, UUID_RE, errorJson, json } from '../_shared/firmas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface FirmanteConContrato {
  id: string
  nombre: string
  rol: string
  firmado_en: string | null
  firma_contratos: {
    titulo: string
    habitacion: string | null
    ruta_original: string
    ruta_firmado: string | null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return errorJson('Método no permitido', 405)

  try {
    const { token } = (await req.json()) as { token?: unknown }
    if (typeof token !== 'string' || !UUID_RE.test(token)) {
      return errorJson('Enlace inválido o vencido', 404)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data, error: errorBusqueda } = await supabase
      .from('firma_firmantes')
      .select('id, nombre, rol, firmado_en, firma_contratos(titulo, habitacion, ruta_original, ruta_firmado)')
      .eq('token', token)
      .maybeSingle()
    // Un fallo técnico no es un enlace inválido: se pide reintentar.
    if (errorBusqueda) {
      console.error(errorBusqueda)
      return errorJson('No se pudo cargar el documento. Intenta de nuevo en unos segundos.', 503)
    }
    const firmante = data as unknown as FirmanteConContrato | null
    if (!firmante) return errorJson('Enlace inválido o vencido', 404)

    const contrato = firmante.firma_contratos
    const ruta = contrato.ruta_firmado ?? contrato.ruta_original
    const { data: url } = await supabase.storage.from('firmas').createSignedUrl(ruta, SEGUNDOS_URL_PDF)
    if (!url) return errorJson('No se pudo abrir el documento', 500)

    if (firmante.firmado_en) {
      return json({
        yaFirmado: true,
        titulo: contrato.titulo,
        nombre: firmante.nombre,
        urlPdf: url.signedUrl,
      })
    }

    const { data: campos } = await supabase
      .from('firma_campos')
      .select('pagina, x, y, ancho, alto')
      .eq('firmante_id', firmante.id)
      .order('pagina')

    return json({
      yaFirmado: false,
      titulo: contrato.titulo,
      habitacion: contrato.habitacion,
      nombre: firmante.nombre,
      rol: firmante.rol,
      campos: (campos ?? []).map((c) => ({
        pagina: c.pagina,
        x: Number(c.x),
        y: Number(c.y),
        ancho: Number(c.ancho),
        alto: Number(c.alto),
      })),
      urlPdf: url.signedUrl,
    })
  } catch (excepcion) {
    console.error(excepcion)
    return errorJson('Ocurrió un error inesperado.', 500)
  }
})
