// Prepara la foto o imagen de una firma para estamparla en el PDF: quita el fondo (queda
// transparente, como una firma dibujada), recorta los bordes vacíos y la reduce.
//
// La tinta se detecta comparando cada píxel con el fondo de su entorno (no con un blanco
// fijo), así que las sombras y las iluminaciones desiguales de una foto no se confunden con firma.

/** Diferencia de luminosidad (0-255) con el fondo por debajo de la cual un píxel es fondo. */
const DIFERENCIA_FONDO = 28
/** Diferencia a partir de la cual un píxel es tinta plena. */
const DIFERENCIA_TINTA = 95

/** Opacidad (0-255) de un píxel según cuánto más oscuro es que su fondo local. */
export function alfaDesdeContraste(diferencia: number): number {
  if (diferencia <= DIFERENCIA_FONDO) return 0
  if (diferencia >= DIFERENCIA_TINTA) return 255
  return Math.round((255 * (diferencia - DIFERENCIA_FONDO)) / (DIFERENCIA_TINTA - DIFERENCIA_FONDO))
}

const ANCHO_TRABAJO = 1000
const ANCHO_SALIDA = 800
const MARGEN = 6
/** El fondo se estima reduciendo la imagen esta cantidad de veces y volviéndola a ampliar. */
const FACTOR_FONDO = 16

function luminosidad(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Devuelve la firma como PNG (data URL) con fondo transparente, o lanza si no se ve ninguna firma. */
export async function procesarImagenFirma(archivo: File): Promise<string> {
  const imagen = await createImageBitmap(archivo)
  const escala = Math.min(1, ANCHO_TRABAJO / imagen.width)
  const ancho = Math.max(1, Math.round(imagen.width * escala))
  const alto = Math.max(1, Math.round(imagen.height * escala))

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No se pudo procesar la imagen.')
  ctx.drawImage(imagen, 0, 0, ancho, alto)
  imagen.close()

  // Fondo local: la imagen muy reducida y vuelta a ampliar es una versión borrosa sin los trazos finos.
  const pequeno = document.createElement('canvas')
  pequeno.width = Math.max(1, Math.ceil(ancho / FACTOR_FONDO))
  pequeno.height = Math.max(1, Math.ceil(alto / FACTOR_FONDO))
  const ctxPequeno = pequeno.getContext('2d')
  const fondoLienzo = document.createElement('canvas')
  fondoLienzo.width = ancho
  fondoLienzo.height = alto
  const ctxFondo = fondoLienzo.getContext('2d', { willReadFrequently: true })
  if (!ctxPequeno || !ctxFondo) throw new Error('No se pudo procesar la imagen.')
  ctxPequeno.imageSmoothingQuality = 'high'
  ctxPequeno.drawImage(lienzo, 0, 0, pequeno.width, pequeno.height)
  ctxFondo.imageSmoothingQuality = 'high'
  ctxFondo.drawImage(pequeno, 0, 0, ancho, alto)

  const datos = ctx.getImageData(0, 0, ancho, alto)
  const fondo = ctxFondo.getImageData(0, 0, ancho, alto).data
  const px = datos.data
  let minX = ancho
  let minY = alto
  let maxX = -1
  let maxY = -1
  let alfaMaximo = 0
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4
      const diferencia =
        luminosidad(fondo[i], fondo[i + 1], fondo[i + 2]) - luminosidad(px[i], px[i + 1], px[i + 2])
      const alfa = Math.min(px[i + 3], alfaDesdeContraste(diferencia))
      px[i + 3] = alfa
      if (alfa > alfaMaximo) alfaMaximo = alfa
      if (alfa > 30) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    throw new Error('No se detectó ninguna firma en la imagen. Usa una foto con tinta oscura sobre fondo claro.')
  }
  // Tinta tenue (poca luz o bolígrafo claro): se refuerza para que la firma no salga pálida en el PDF.
  if (alfaMaximo < 230) {
    const refuerzo = 255 / alfaMaximo
    for (let i = 3; i < px.length; i += 4) px[i] = Math.min(255, Math.round(px[i] * refuerzo))
  }
  ctx.putImageData(datos, 0, 0)

  const x0 = Math.max(0, minX - MARGEN)
  const y0 = Math.max(0, minY - MARGEN)
  const w = Math.min(ancho, maxX + MARGEN) - x0
  const h = Math.min(alto, maxY + MARGEN) - y0
  const reduccion = Math.min(1, ANCHO_SALIDA / w)

  const salida = document.createElement('canvas')
  salida.width = Math.max(1, Math.round(w * reduccion))
  salida.height = Math.max(1, Math.round(h * reduccion))
  salida.getContext('2d')?.drawImage(lienzo, x0, y0, w, h, 0, 0, salida.width, salida.height)
  return salida.toDataURL('image/png')
}
