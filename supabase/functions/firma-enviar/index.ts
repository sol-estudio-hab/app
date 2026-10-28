// Sol Estudio Hab — Edge Function: firma-enviar
//
// Recibe la firma de un firmante (imagen PNG dibujada en su celular), la estampa
// en el servidor sobre el PDF y registra la firma. Se despliega con
// --no-verify-jwt: el token (UUID impredecible, uno por firmante) es la credencial.
//
// Garantías:
// - El token se "reclama" de forma atómica: solo una solicitud puede firmar con él.
// - El PDF final lo arma el servidor con las casillas guardadas, así que el
//   navegador no puede subir un documento alterado.
// - Si dos firmantes envían a la vez, un control de versión (compare-and-set sobre
//   firma_contratos.version) hace que el segundo parta del PDF ya firmado por el
//   primero; ninguna firma se pierde.
// - Si algo falla después de reclamar el token, se libera para poder reintentar.

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  CORS,
  SEGUNDOS_URL_PDF,
  UUID_RE,
  errorJson,
  estamparFirmas,
  json,
  type CampoFirma,
} from '../_shared/firmas.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PREFIJO_PNG = 'data:image/png;base64,'
const MAX_FIRMA_BASE64 = 900_000
const INTENTOS = 4

interface Solicitud {
  token?: unknown
  firmaPng?: unknown
  acepto?: unknown
}

function base64ABytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return errorJson('Método no permitido', 405)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  let firmanteReclamado: string | null = null
  let contratoId: string | null = null

  try {
    const { token, firmaPng, acepto } = (await req.json()) as Solicitud

    if (typeof token !== 'string' || !UUID_RE.test(token)) {
      return errorJson('Enlace inválido o vencido', 404)
    }
    if (acepto !== true) return errorJson('Debes aceptar el acuerdo para firmar.')
    if (
      typeof firmaPng !== 'string' ||
      !firmaPng.startsWith(PREFIJO_PNG) ||
      firmaPng.length > MAX_FIRMA_BASE64
    ) {
      return errorJson('La firma no es válida. Dibújala de nuevo.')
    }
    let png: Uint8Array
    try {
      png = base64ABytes(firmaPng.slice(PREFIJO_PNG.length))
    } catch {
      return errorJson('La firma no es válida. Dibújala de nuevo.')
    }

    // ----- Firmante y sus casillas -----
    const { data: firmante } = await supabase
      .from('firma_firmantes')
      .select('id, contrato_id, firmado_en')
      .eq('token', token)
      .maybeSingle()
    if (!firmante) return errorJson('Enlace inválido o vencido', 404)
    if (firmante.firmado_en) return errorJson('Este documento ya fue firmado.', 409)
    contratoId = firmante.contrato_id as string

    const { data: camposData } = await supabase
      .from('firma_campos')
      .select('pagina, x, y, ancho, alto')
      .eq('firmante_id', firmante.id)
    const campos: CampoFirma[] = (camposData ?? []).map((c) => ({
      pagina: c.pagina,
      x: Number(c.x),
      y: Number(c.y),
      ancho: Number(c.ancho),
      alto: Number(c.alto),
    }))
    if (campos.length === 0) return errorJson('Este documento no tiene casillas de firma para ti.')

    // ----- Reclamar el token de forma atómica -----
    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      null
    const { data: reclamado } = await supabase
      .from('firma_firmantes')
      .update({ firmado_en: new Date().toISOString(), ip })
      .eq('id', firmante.id)
      .is('firmado_en', null)
      .select('id')
      .maybeSingle()
    if (!reclamado) return errorJson('Este documento ya fue firmado.', 409)
    firmanteReclamado = firmante.id

    // ----- Estampar sobre el último PDF (con reintento por concurrencia) -----
    let rutaFinal: string | null = null
    for (let intento = 1; intento <= INTENTOS && !rutaFinal; intento++) {
      const { data: contrato, error: errorContrato } = await supabase
        .from('firma_contratos')
        .select('id, version, ruta_original, ruta_firmado')
        .eq('id', contratoId)
        .single()
      if (errorContrato || !contrato) throw new Error('Contrato no encontrado')

      const rutaBase = (contrato.ruta_firmado ?? contrato.ruta_original) as string
      const { data: archivo, error: errorDescarga } = await supabase.storage
        .from('firmas')
        .download(rutaBase)
      if (errorDescarga || !archivo) throw new Error('No se pudo leer el PDF')

      const pdfFirmado = await estamparFirmas(new Uint8Array(await archivo.arrayBuffer()), png, campos)

      const version = contrato.version as number
      const rutaNueva = `firmados/${contrato.id}/v${version + 1}.pdf`
      const { error: errorSubida } = await supabase.storage
        .from('firmas')
        .upload(rutaNueva, pdfFirmado, { contentType: 'application/pdf', upsert: false })
      // Si esa versión ya existe, otro firmante ganó la carrera: reintentar.
      if (errorSubida) continue

      const { count: pendientes } = await supabase
        .from('firma_firmantes')
        .select('id', { count: 'exact', head: true })
        .eq('contrato_id', contrato.id)
        .is('firmado_en', null)

      const { data: actualizado } = await supabase
        .from('firma_contratos')
        .update({
          ruta_firmado: rutaNueva,
          version: version + 1,
          estado: (pendientes ?? 0) === 0 ? 'completado' : 'parcial',
        })
        .eq('id', contrato.id)
        .eq('version', version)
        .select('id')
        .maybeSingle()

      if (actualizado) {
        rutaFinal = rutaNueva
        if (contrato.ruta_firmado) {
          await supabase.storage.from('firmas').remove([contrato.ruta_firmado as string])
        }
      } else {
        await supabase.storage.from('firmas').remove([rutaNueva])
      }
    }
    if (!rutaFinal) throw new Error('No se pudo registrar la firma (conflicto repetido)')

    const { data: url } = await supabase.storage
      .from('firmas')
      .createSignedUrl(rutaFinal, SEGUNDOS_URL_PDF)

    return json({ ok: true, urlPdf: url?.signedUrl ?? null })
  } catch (excepcion) {
    console.error(excepcion)
    // Liberar el token para que el firmante pueda reintentar.
    if (firmanteReclamado) {
      await supabase
        .from('firma_firmantes')
        .update({ firmado_en: null, ip: null })
        .eq('id', firmanteReclamado)
      if (contratoId) {
        await supabase
          .from('firma_contratos')
          .update({ estado: 'parcial' })
          .eq('id', contratoId)
          .eq('estado', 'completado')
      }
    }
    return errorJson('No se pudo registrar tu firma. Intenta de nuevo.', 500)
  }
})
