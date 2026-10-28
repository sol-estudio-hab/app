import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

interface Props {
  /** Recibe la firma como PNG (data URL), recortada a su contenido. */
  onAplicar: (firmaPng: string) => void
  onCancelar: () => void
}

const ANCHO_MAXIMO_PNG = 800

/** Recorta el lienzo al área realmente dibujada, para que la firma ocupe bien su casilla. */
function recortarFirma(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')
  const { width, height } = canvas
  const pixeles = ctx.getImageData(0, 0, width, height).data

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixeles[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return canvas.toDataURL('image/png')

  const margen = 6
  const x0 = Math.max(0, minX - margen)
  const y0 = Math.max(0, minY - margen)
  const w = Math.min(width, maxX + margen) - x0
  const h = Math.min(height, maxY + margen) - y0
  const reduccion = Math.min(1, ANCHO_MAXIMO_PNG / w)

  const salida = document.createElement('canvas')
  salida.width = Math.max(1, Math.round(w * reduccion))
  salida.height = Math.max(1, Math.round(h * reduccion))
  salida.getContext('2d')?.drawImage(canvas, x0, y0, w, h, 0, 0, salida.width, salida.height)
  return salida.toDataURL('image/png')
}

/** Panel inferior (hoja) para dibujar la firma con el dedo o el mouse. */
export default function PanelFirma({ onAplicar, onCancelar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [vacio, setVacio] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const densidad = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * densidad
    canvas.height = canvas.offsetHeight * densidad
    canvas.getContext('2d')?.scale(densidad, densidad)

    const pad = new SignaturePad(canvas, { penColor: '#0b2540', minWidth: 0.9, maxWidth: 2.8 })
    pad.addEventListener('endStroke', () => setVacio(pad.isEmpty()))
    padRef.current = pad
    return () => pad.off()
  }, [])

  function borrar() {
    padRef.current?.clear()
    setVacio(true)
  }

  function aplicar() {
    const canvas = canvasRef.current
    if (!canvas || padRef.current?.isEmpty()) return
    onAplicar(recortarFirma(canvas))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Dibuja tu firma"
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-[#055741]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          Dibuja tu firma
        </h2>
        <p className="mt-1 text-sm text-slate-600">Usa el dedo o el mouse dentro del recuadro.</p>

        <canvas
          ref={canvasRef}
          className="mt-3 h-52 w-full rounded-xl border-2 border-dashed border-[#D4A437] bg-[#FFFDF8]"
          style={{ touchAction: 'none' }}
        />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={borrar}
            className="rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={vacio}
            className="rounded-xl bg-[#055741] px-3 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
