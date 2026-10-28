/** Copia texto al portapapeles; devuelve false si el navegador no lo permite. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copiado = document.execCommand('copy')
    document.body.removeChild(area)
    return copiado
  }
}
