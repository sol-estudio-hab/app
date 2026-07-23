export type EstadoAcuerdo = 'activo' | 'finalizado'
export type EstadoPago = 'pendiente' | 'cargado' | 'verificado' | 'rechazado'

export interface Huesped {
  id: string
  correo: string
  nombres: string
  numero_habitacion: string
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export interface Acuerdo {
  id: string
  huesped_id: string
  fecha_ingreso: string // formato YYYY-MM-DD
  meses_acuerdo: number
  estado: EstadoAcuerdo
  creado_en: string
}

export interface Pago {
  id: string
  acuerdo_id: string
  mes_pagado: string // formato YYYY-MM
  archivo_url: string | null
  estado: EstadoPago
  fecha_carga: string | null
  verificado_por: string | null
  fecha_verificacion: string | null
  observaciones: string | null
}

export type TipoNotificacion = 'recordatorio' | 'mora' | 'confirmacion' | 'fin_acuerdo' | 'aviso_basura'
export type CanalNotificacion = 'correo' | 'push' | 'app'

export interface Notificacion {
  id: string
  huesped_id: string
  tipo: TipoNotificacion
  canal: CanalNotificacion
  mes_referencia: string | null
  enviado_en: string
  leido: boolean
}
