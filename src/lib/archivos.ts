export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export function extensionParaMime(mime: string): string {
  return EXTENSION_POR_MIME[mime] ?? 'bin'
}
