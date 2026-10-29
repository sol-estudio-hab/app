// Utilidades de la firma de PDFs (ver migración 0018 y las Edge Functions
// firma-sesion / firma-enviar).

/** Casilla de firma en puntos PDF (1 pt = 1/72"), origen abajo-izquierda de la página. */
export interface CampoFirma {
  pagina: number
  x: number
  y: number
  ancho: number
  alto: number
}

/** Rectángulo en píxeles de pantalla, origen arriba-izquierda de la página mostrada. */
export interface RectPantalla {
  left: number
  top: number
  width: number
  height: number
}

export interface FirmaContrato {
  id: string
  titulo: string
  habitacion: string | null
  ruta_original: string
  ruta_firmado: string | null
  estado: 'pendiente' | 'parcial' | 'completado'
  creado_en: string
  huesped_id: string | null
  correo_enviado_en: string | null
}

/** Roles de firmante. El arrendador (propietario) firma desde el panel cargando una imagen. */
export const ROLES_FIRMANTE: { valor: string; etiqueta: string }[] = [
  { valor: 'arrendador', etiqueta: 'Arrendador (propietario)' },
  { valor: 'responsable', etiqueta: 'Responsable' },
  { valor: 'estudiante', etiqueta: 'Estudiante' },
]

export const ROL_ARRENDADOR = 'arrendador'

export interface FirmaFirmante {
  id: string
  contrato_id: string
  token: string
  nombre: string
  rol: string
  correo: string | null
  telefono: string | null
  firmado_en: string | null
}

export const ETIQUETA_ESTADO_FIRMA: Record<FirmaContrato['estado'], string> = {
  pendiente: 'Pendiente',
  parcial: 'Firma parcial',
  completado: 'Completado',
}

/** Tamaño mínimo (en píxeles) de una casilla dibujada, para descartar toques accidentales. */
export const TAMANO_MINIMO_CAMPO_PX = 24

/** Convierte un rectángulo dibujado en pantalla a una casilla en puntos PDF. */
export function rectPantallaACampo(
  rect: RectPantalla,
  escala: number,
  altoPaginaPts: number,
): Omit<CampoFirma, 'pagina'> {
  return {
    x: rect.left / escala,
    y: altoPaginaPts - (rect.top + rect.height) / escala,
    ancho: rect.width / escala,
    alto: rect.height / escala,
  }
}

/** Convierte una casilla en puntos PDF al rectángulo que se dibuja en pantalla. */
export function campoARectPantalla(
  campo: Pick<CampoFirma, 'x' | 'y' | 'ancho' | 'alto'>,
  escala: number,
  altoPaginaPts: number,
): RectPantalla {
  return {
    left: campo.x * escala,
    top: (altoPaginaPts - campo.y - campo.alto) * escala,
    width: campo.ancho * escala,
    height: campo.alto * escala,
  }
}

/** Rectángulo normalizado entre dos puntos, sin importar en qué dirección se arrastró. */
export function rectEntrePuntos(x0: number, y0: number, x1: number, y1: number): RectPantalla {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

/** Limita un rectángulo para que no se salga de la página mostrada. */
export function limitarRect(rect: RectPantalla, ancho: number, alto: number): RectPantalla {
  const left = Math.max(0, Math.min(rect.left, ancho))
  const top = Math.max(0, Math.min(rect.top, alto))
  return {
    left,
    top,
    width: Math.min(rect.width, ancho - left),
    height: Math.min(rect.height, alto - top),
  }
}

/**
 * Origen de los enlaces de firma. Se configura con VITE_URL_FIRMAS
 * (p. ej. https://firmas.solestudiohab.com) una vez asociado el dominio; mientras
 * tanto se usa el origen actual para que los enlaces copiados siempre funcionen.
 */
export function enlaceFirma(token: string, origen: string): string {
  return `${origen.replace(/\/$/, '')}/firmar?t=${token}`
}

/** Origen público de los enlaces: VITE_URL_FIRMAS si está configurado, o el sitio actual. */
export function origenFirmas(): string {
  return import.meta.env.VITE_URL_FIRMAS || window.location.origin
}

export function mensajeWhatsappFirma(nombre: string, habitacion: string | null, enlace: string): string {
  const lugar = habitacion ? ` de la habitación ${habitacion}` : ''
  return `Hola ${nombre}, firma tu acuerdo de arrendamiento${lugar} aquí: ${enlace}`
}
