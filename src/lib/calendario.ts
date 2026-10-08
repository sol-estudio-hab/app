import type { Pago } from '../types/dominio'

export type EstadoMes =
  | 'verificado'
  | 'en_revision'
  | 'rechazado'
  | 'pendiente'
  | 'vencido'
  | 'proximo'

export const ETIQUETA_ESTADO_MES: Record<EstadoMes, string> = {
  verificado: 'Pagado',
  en_revision: 'En revisión',
  rechazado: 'Rechazado',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
  proximo: 'Próximo',
}

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

/** Genera el mes (YYYY-MM) y la fecha de vencimiento de cada pago del acuerdo. */
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

/** Estado visual de un mes según el pago asociado (si existe) y la fecha de vencimiento. */
export function estadoDelMes(vencimiento: Date, pago: Pago | undefined, hoy = new Date()): EstadoMes {
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

/** Días antes del vencimiento en que un mes sin pago pasa de "Pagado" a "Pendiente". */
export const DIAS_AVISO_PREVIO = 5

function diasHastaVencimiento(vencimiento: Date, hoy: Date): number {
  const aUtc = (f: Date) => Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())
  return Math.round((aUtc(vencimiento) - aUtc(hoy)) / 86_400_000)
}

/**
 * Estado visual de cada mes del acuerdo (misma longitud que `meses`). Igual que
 * `estadoDelMes`, salvo el caso "sin pago y todavía no vencido":
 * - primer mes del acuerdo, o faltan 5 días o menos → "pendiente";
 * - faltan más de 5 días → "proximo" (todavía no abre su ventana de pago).
 * El primer mes se exceptúa porque se paga al ingresar.
 */
export function estadosMesesAcuerdo(
  meses: MesAcuerdo[],
  pagoDeMes: (mes: string) => Pago | undefined,
  hoy = new Date(),
): EstadoMes[] {
  return meses.map((m, i) => {
    const estado = estadoDelMes(m.vencimiento, pagoDeMes(m.mes), hoy)
    if (estado !== 'pendiente') return estado
    if (i === 0 || diasHastaVencimiento(m.vencimiento, hoy) <= DIAS_AVISO_PREVIO) return 'pendiente'
    return 'proximo'
  })
}

/**
 * Estado "actual" del huésped: el primer mes, en orden cronológico, que no está "Pagado" ni
 * "Próximo". Así, si un mes anterior quedó vencido, el estado se mantiene "vencido" al
 * cambiar de mes en vez de volver a mostrar "pendiente", y un huésped con el ciclo vigente
 * pagado sigue "Pagado" (no "Próximo") hasta 5 días antes del siguiente vencimiento.
 */
export function estadoActualAcuerdo(
  meses: MesAcuerdo[],
  pagoDeMes: (mes: string) => Pago | undefined,
  hoy = new Date(),
): EstadoMes | null {
  for (const estado of estadosMesesAcuerdo(meses, pagoDeMes, hoy)) {
    if (estado !== 'verificado' && estado !== 'proximo') return estado
  }
  return meses.length > 0 ? 'verificado' : null
}

/** Estado visual de un cargue de depósito (no depende de una fecha de vencimiento). */
export function estadoDeposito(estado: Pago['estado'] | undefined): EstadoMes {
  if (estado === 'verificado') return 'verificado'
  if (estado === 'cargado') return 'en_revision'
  if (estado === 'rechazado') return 'rechazado'
  return 'pendiente'
}

/** Formatea "2026-01" como "Enero 2026". */
export function formatearMes(mesYYYYMM: string): string {
  const [anio, mes] = mesYYYYMM.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, 1)
  const texto = fecha.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
