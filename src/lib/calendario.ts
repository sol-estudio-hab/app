import type { Pago } from '../types/dominio'

export type EstadoMes = 'verificado' | 'en_revision' | 'rechazado' | 'pendiente' | 'vencido'

export const ETIQUETA_ESTADO_MES: Record<EstadoMes, string> = {
  verificado: 'Pagado',
  en_revision: 'En revisión',
  rechazado: 'Rechazado',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
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

/** Formatea "2026-01" como "Enero 2026". */
export function formatearMes(mesYYYYMM: string): string {
  const [anio, mes] = mesYYYYMM.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, 1)
  const texto = fecha.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
