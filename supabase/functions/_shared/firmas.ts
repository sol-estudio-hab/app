// Utilidades compartidas por las Edge Functions de firma de PDFs
// (firma-sesion y firma-enviar).

import { PDFDocument } from 'npm:pdf-lib@1.17.1'

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
