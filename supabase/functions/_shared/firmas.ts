// Utilidades compartidas por las Edge Functions de firma de PDFs
// (firma-sesion y firma-enviar).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'
import { alCompletar } from './firmas-correo.ts'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Vigencia de las URLs firmadas del PDF (15 minutos). */
export const SEGUNDOS_URL_PDF = 15 * 60

export function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export function errorJson(mensaje: string, estado = 400): Response {
  return json({ error: mensaje }, estado)
}

/** Error esperado (se le explica al usuario con su código HTTP), a diferencia de un fallo inesperado. */
export class ErrorFirma extends Error {
  estado: number
  constructor(mensaje: string, estado = 400) {
    super(mensaje)
    this.estado = estado
  }
}

const PREFIJO_PNG = 'data:image/png;base64,'
const MAX_FIRMA_BASE64 = 900_000

/** Valida una firma enviada como data URL PNG y devuelve sus bytes (o null si no es válida). */
export function bytesDeFirmaPng(firmaPng: unknown): Uint8Array | null {
  if (typeof firmaPng !== 'string' || !firmaPng.startsWith(PREFIJO_PNG) || firmaPng.length > MAX_FIRMA_BASE64) {
    return null
  }
  try {
    return Uint8Array.from(atob(firmaPng.slice(PREFIJO_PNG.length)), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export interface CampoFirma {
  pagina: number
  x: number
  y: number
  ancho: number
  alto: number
}

/**
 * Estampa la imagen de la firma (PNG) en cada casilla indicada y devuelve el PDF
 * resultante. Las coordenadas están en puntos PDF con origen abajo-izquierda de la
 * caja visible de la página (CropBox, o MediaBox si no existe). La imagen se ajusta
 * dentro de la casilla conservando su proporción y centrada.
 */
export async function estamparFirmas(
  pdfBytes: Uint8Array,
  firmaPng: Uint8Array,
  campos: CampoFirma[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes)
  const imagen = await pdf.embedPng(firmaPng)
  const paginas = pdf.getPages()

  for (const campo of campos) {
    const pagina = paginas[campo.pagina - 1]
    if (!pagina) throw new Error(`La página ${campo.pagina} no existe en el PDF`)
    const caja = pagina.getCropBox()
    const escala = Math.min(campo.ancho / imagen.width, campo.alto / imagen.height)
    const ancho = imagen.width * escala
    const alto = imagen.height * escala
    pagina.drawImage(imagen, {
      x: caja.x + campo.x + (campo.ancho - ancho) / 2,
      y: caja.y + campo.y + (campo.alto - alto) / 2,
      width: ancho,
      height: alto,
    })
  }

  return await pdf.save()
}

const INTENTOS = 4

/**
 * Registra la firma de un firmante: reclama su turno de forma atómica, estampa la imagen en el
 * PDF (reintentando si otro firmante guardó al mismo tiempo, gracias a la versión del contrato)
 * y, si con esta firma el contrato queda completo, lo vincula al huésped y envía la copia.
 * Si algo falla después de reclamar el turno, lo libera para poder reintentar.
 */
export async function firmarYRegistrar(
  supabase: SupabaseClient,
  firmante: { id: string; contrato_id: string },
  png: Uint8Array,
  ip: string | null,
): Promise<{ urlPdf: string | null; completado: boolean }> {
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
  if (campos.length === 0) throw new ErrorFirma('Este documento no tiene casillas de firma para este firmante.')

  const { data: reclamado } = await supabase
    .from('firma_firmantes')
    .update({ firmado_en: new Date().toISOString(), ip })
    .eq('id', firmante.id)
    .is('firmado_en', null)
    .select('id')
    .maybeSingle()
  if (!reclamado) throw new ErrorFirma('Este documento ya fue firmado.', 409)

  const contratoId = firmante.contrato_id
  let rutaFinal: string | null = null
  let completado = false
  try {
    for (let intento = 1; intento <= INTENTOS && !rutaFinal; intento++) {
      const { data: contrato, error: errorContrato } = await supabase
        .from('firma_contratos')
        .select('id, version, ruta_original, ruta_firmado')
        .eq('id', contratoId)
        .single()
      if (errorContrato || !contrato) throw new Error('Contrato no encontrado')

      const rutaBase = (contrato.ruta_firmado ?? contrato.ruta_original) as string
      const { data: archivo, error: errorDescarga } = await supabase.storage.from('firmas').download(rutaBase)
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
      const quedanFirmas = (pendientes ?? 0) > 0

      const { data: actualizado } = await supabase
        .from('firma_contratos')
        .update({
          ruta_firmado: rutaNueva,
          version: version + 1,
          estado: quedanFirmas ? 'parcial' : 'completado',
        })
        .eq('id', contrato.id)
        .eq('version', version)
        .select('id')
        .maybeSingle()

      if (actualizado) {
        rutaFinal = rutaNueva
        completado = !quedanFirmas
        if (contrato.ruta_firmado) {
          await supabase.storage.from('firmas').remove([contrato.ruta_firmado as string])
        }
      } else {
        await supabase.storage.from('firmas').remove([rutaNueva])
      }
    }
    if (!rutaFinal) throw new Error('No se pudo registrar la firma (conflicto repetido)')
  } catch (excepcion) {
    // El estampado falló: liberar el turno para que pueda reintentar.
    await supabase.from('firma_firmantes').update({ firmado_en: null, ip: null }).eq('id', firmante.id)
    await supabase.from('firma_contratos').update({ estado: 'parcial' }).eq('id', contratoId).eq('estado', 'completado')
    throw excepcion
  }

  // La firma ya quedó guardada: de aquí en adelante nada debe liberar el turno.
  const { data: url } = await supabase.storage.from('firmas').createSignedUrl(rutaFinal as string, SEGUNDOS_URL_PDF)

  // Con todas las firmas: vincular al huésped y enviar la copia. Un fallo aquí no invalida la firma.
  if (completado) {
    try {
      await alCompletar(supabase, contratoId)
    } catch (excepcion) {
      console.error('Error al completar el contrato firmado:', excepcion)
    }
  }
  return { urlPdf: url?.signedUrl ?? null, completado }
}
