export type IconoId =
  | 'panel'
  | 'nuevo'
  | 'firmas'
  | 'reportes'
  | 'pagos'
  | 'notificaciones'
  | 'perfil'

export interface OpcionMenu {
  id: IconoId
  to: string
  titulo: string
  descripcion: string
}

const OPCIONES_ADMIN: OpcionMenu[] = [
  {
    id: 'panel',
    to: '/admin',
    titulo: 'Panel admin',
    descripcion: 'Consulta el estado de pago de cada huésped, el reglamento y los datos de sus cuentas.',
  },
  {
    id: 'nuevo',
    to: '/admin/huespedes/nuevo',
    titulo: 'Nuevo huésped',
    descripcion: 'Crea la cuenta de un huésped que no se registró para que reciba avisos y recordatorios.',
  },
  {
    id: 'firmas',
    to: '/admin/firmas',
    titulo: 'Firmas',
    descripcion: 'Sube contratos en PDF y genera los enlaces para que estudiantes y responsables los firmen.',
  },
  {
    id: 'reportes',
    to: '/admin/reportes',
    titulo: 'Reportes',
    descripcion: 'Resumen de pagos por mes, avance de cada huésped y exportación a CSV.',
  },
]

const OPCION_PAGOS: OpcionMenu = {
  id: 'pagos',
  to: '/pagos',
  titulo: 'Mis pagos',
  descripcion: 'Consulta el estado de cada mes y sube tus comprobantes de pago y de depósito.',
}

const OPCION_NOTIFICACIONES: OpcionMenu = {
  id: 'notificaciones',
  to: '/notificaciones',
  titulo: 'Notificaciones',
  descripcion: 'Revisa tus recordatorios y los avisos de la administración.',
}

const OPCION_PERFIL: OpcionMenu = {
  id: 'perfil',
  to: '/perfil',
  titulo: 'Mi perfil',
  descripcion: 'Actualiza tus nombres, tu WhatsApp y tu contraseña, y revisa tus contratos.',
}

/**
 * Opciones del menú principal (tarjetas) y de la hamburguesa del encabezado, según el rol.
 * Un administrador sin perfil de huésped no ve "Mis pagos" ni "Notificaciones", que no le sirven.
 */
export function opcionesMenu({ esAdmin, tieneHuesped }: { esAdmin: boolean; tieneHuesped: boolean }): OpcionMenu[] {
  const personales: OpcionMenu[] = []
  if (tieneHuesped || !esAdmin) personales.push(OPCION_PAGOS)
  if (tieneHuesped) personales.push(OPCION_NOTIFICACIONES)
  personales.push(OPCION_PERFIL)
  return [...(esAdmin ? OPCIONES_ADMIN : []), ...personales]
}
