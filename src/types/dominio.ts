export type EstadoAcuerdo = 'activo' | 'finalizado'
export type EstadoPago = 'pendiente' | 'cargado' | 'verificado' | 'rechazado'

export interface Huesped {
  id: string
  correo: string
  nombres: string
  numero_habitacion: string
  numero_whatsapp: string | null
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
  deposito_pago_unico: boolean
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

export interface Deposito {
  id: string
  acuerdo_id: string
  numero_cargue: 1 | 2
  archivo_url: string | null
  estado: EstadoPago
  fecha_carga: string | null
  verificado_por: string | null
  fecha_verificacion: string | null
  observaciones: string | null
}

export interface Contrato {
  id: string
  huesped_id: string
  archivo_url: string
  nombre_archivo: string
  subido_por: string
  creado_en: string
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
