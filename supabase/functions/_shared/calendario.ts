// Réplica mínima de src/lib/calendario.ts para usar desde las Edge
// Functions (Deno no puede importar directamente el código del frontend).

export interface MesAcuerdo {
  mes: string // YYYY-MM
  vencimiento: Date
}

function sumarMeses(fecha: Date, cantidad: number): Date {
  const resultado = new Date(fecha)
  const diaOriginal = resultado.getDate()
  resultado.setDate(1)
  resultado.setMonth(resultado.getMonth() + cantidad)
  const ultimoDiaDelMes = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate()
  resultado.setDate(Math.min(diaOriginal, ultimoDiaDelMes))
  return resultado
}

export function generarMesesAcuerdo(fechaIngreso: string, mesesAcuerdo: number): MesAcuerdo[] {
  const inicio = new Date(`${fechaIngreso}T00:00:00`)
  const meses: MesAcuerdo[] = []
  for (let i = 0; i < mesesAcuerdo; i++) {
    const vencimiento = sumarMeses(inicio, i)
    const mes = `${vencimiento.getFullYear()}-${String(vencimiento.getMonth() + 1).padStart(2, '0')}`
    meses.push({ mes, vencimiento })
  }
  return meses
}

/** Fecha en que termina la cobertura del acuerdo (un mes después del último pago). */
export function fechaFinAcuerdo(fechaIngreso: string, mesesAcuerdo: number): Date {
  return sumarMeses(new Date(`${fechaIngreso}T00:00:00`), mesesAcuerdo)
}

export function mismaFecha(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha)
  resultado.setDate(resultado.getDate() + dias)
  return resultado
}

export type EstadoMes = 'verificado' | 'en_revision' | 'rechazado' | 'pendiente' | 'vencido'

interface PagoEstado {
  estado: string
}

/** Réplica de estadoDelMes en src/lib/calendario.ts. */
export function estadoDelMes(vencimiento: Date, pago: PagoEstado | undefined, hoy = new Date()): EstadoMes {
  if (pago?.estado === 'verificado') return 'verificado'
  if (pago?.estado === 'cargado') return 'en_revision'
  if (pago?.estado === 'rechazado') return 'rechazado'
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const vencimientoSinHora = new Date(
    vencimiento.getFullYear(),
    vencimiento.getMonth(),
    vencimiento.getDate(),
  )
  return hoySinHora > vencimientoSinHora ? 'vencido' : 'pendiente'
}

/**
 * Réplica de estadoActualAcuerdo en src/lib/calendario.ts: primer mes sin verificar en
 * orden cronológico, para que un mes anterior vencido no se "olvide" al empezar un mes
 * nuevo.
 */
export function estadoActualAcuerdo(
  meses: MesAcuerdo[],
  pagoDeMes: (mes: string) => PagoEstado | undefined,
  hoy = new Date(),
): EstadoMes | null {
  for (const m of meses) {
    const estado = estadoDelMes(m.vencimiento, pagoDeMes(m.mes), hoy)
    if (estado !== 'verificado') return estado
  }
  return meses.length > 0 ? 'verificado' : null
}
