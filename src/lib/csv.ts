/** Genera y descarga un archivo CSV en el navegador (compatible con Excel, con BOM UTF-8). */
export function exportarCsv(nombreArchivo: string, encabezados: string[], filas: string[][]) {
  const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`
  const contenido = [encabezados, ...filas]
    .map((fila) => fila.map(escapar).join(','))
    .join('\r\n')

  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}
