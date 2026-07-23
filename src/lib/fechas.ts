/** Día del mes (1-31) en que vence el pago, según la fecha de ingreso del acuerdo. */
export function diaDePago(fechaIngreso: string): number {
  return new Date(`${fechaIngreso}T00:00:00`).getDate()
}

/** Meses completos transcurridos desde la fecha de ingreso hasta hoy. */
export function mesesTranscurridos(fechaIngreso: string, hoy = new Date()): number {
  const inicio = new Date(`${fechaIngreso}T00:00:00`)
  let meses =
    (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
  if (hoy.getDate() < inicio.getDate()) meses -= 1
  return Math.max(0, meses)
}
