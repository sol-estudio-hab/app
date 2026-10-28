import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { cargarPdfjs } from './cargarPdfjs'

export interface InfoPagina {
  numero: number
  /** Píxeles de pantalla por punto PDF (para convertir coordenadas). */
  escala: number
  anchoPts: number
  altoPts: number
}

interface Props {
  url?: string
  datos?: ArrayBuffer
  /** Contenido que se dibuja encima de cada página (casillas, vista previa de firma…). */
  renderCapa?: (info: InfoPagina) => ReactNode
}

/** Muestra todas las páginas de un PDF una debajo de otra, ajustadas al ancho disponible. */
export default function VisorPdf({ url, datos, renderCapa }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const elemento = contenedorRef.current
    if (!elemento) return
    const medir = () => setAncho(Math.floor(elemento.clientWidth))
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    let cancelado = false
    let tarea: PDFDocumentLoadingTask | null = null
    setDoc(null)
    setError(null)
    if (!url && !datos) return

    ;(async () => {
      try {
        const pdfjs = await cargarPdfjs()
        if (cancelado) return
        tarea = pdfjs.getDocument(url ? { url } : { data: new Uint8Array(datos!.slice(0)) })
        const documento = await tarea.promise
        if (!cancelado) setDoc(documento)
      } catch {
        if (!cancelado) setError('No se pudo abrir el PDF.')
      }
    })()

    return () => {
      cancelado = true
      void tarea?.destroy()
    }
  }, [url, datos])

  return (
    <div ref={contenedorRef} className="flex w-full flex-col gap-3">
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      {!doc && !error && <p className="py-8 text-center text-sm text-slate-500">Cargando documento…</p>}
      {doc &&
        ancho > 0 &&
        Array.from({ length: doc.numPages }, (_, i) => (
          <PaginaPdf key={i + 1} doc={doc} numero={i + 1} ancho={ancho} renderCapa={renderCapa} />
        ))}
    </div>
  )
}

function PaginaPdf({
  doc,
  numero,
  ancho,
  renderCapa,
}: {
  doc: PDFDocumentProxy
  numero: number
  ancho: number
  renderCapa?: (info: InfoPagina) => ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [medidas, setMedidas] = useState<{ anchoPts: number; altoPts: number } | null>(null)

  useEffect(() => {
    let cancelado = false
    let tarea: RenderTask | null = null

    doc
      .getPage(numero)
      .then(async (pagina) => {
        if (cancelado) return
        const base = pagina.getViewport({ scale: 1 })
        setMedidas({ anchoPts: base.width, altoPts: base.height })

        const canvas = canvasRef.current
        if (!canvas) return
        const densidad = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = pagina.getViewport({ scale: (ancho / base.width) * densidad })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        tarea = pagina.render({ canvas, viewport })
        await tarea.promise
      })
      .catch(() => {
        // Render cancelado al cambiar el ancho o cerrar la pantalla: no es un error.
      })

    return () => {
      cancelado = true
      tarea?.cancel()
    }
  }, [doc, numero, ancho])

  const escala = medidas ? ancho / medidas.anchoPts : 1
  const alto = medidas ? medidas.altoPts * escala : ancho * 1.35

  return (
    <div
      className="relative mx-auto bg-white shadow-md"
      style={{ width: ancho, height: alto }}
      data-pagina={numero}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {medidas && renderCapa && (
        <div className="absolute inset-0">
          {renderCapa({ numero, escala, anchoPts: medidas.anchoPts, altoPts: medidas.altoPts })}
        </div>
      )}
    </div>
  )
}
