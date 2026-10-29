// Asunto y nombre de archivo del correo con el acuerdo firmado. Sin dependencias
// para poder probarlo con vitest (ver src/lib/asunto.test.ts).

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** 21 de septiembre de 2026 → "21 Sep 26". */
export function fechaCorta(fecha: Date): string {
  const anio = String(fecha.getFullYear()).slice(-2)
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]} ${anio}`
}

/** "Leonel Alexander Gómez" → "Leonel". */
export function primerNombre(nombres: string): string {
  return nombres.trim().split(/\s+/)[0] ?? ''
}

export interface DatosAsunto {
  nombres: string
  habitacion: string
  inicio: Date
  fin: Date
}

/** "Acuerdo Firmado Leonel H105 21 Sep 26 - 20 May 27" */
export function asuntoAcuerdoFirmado({ nombres, habitacion, inicio, fin }: DatosAsunto): string {
  return `Acuerdo Firmado ${primerNombre(nombres)} H${habitacion} ${fechaCorta(inicio)} - ${fechaCorta(fin)}`
}

/** Nombre del PDF adjunto, sin caracteres problemáticos para un archivo. */
export function nombreArchivoAcuerdo(nombres: string, habitacion: string): string {
  const limpio = `Acuerdo Firmado ${primerNombre(nombres)} H${habitacion}`.replace(/[^\p{L}\p{N} _-]/gu, '')
  return `${limpio}.pdf`
}
