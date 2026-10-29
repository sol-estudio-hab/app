import { type ChangeEvent, type RefObject, useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { procesarImagenFirma } from '../../lib/imagenFirma'

interface Props {
  /** Recibe la firma como PNG (data URL) con fondo transparente. */
  onAplicar: (firmaPng: string) => void
  onCancelar: () => void
  titulo?: string
  descripcion?: string
  /** Deshabilita los botones mientras se envía la firma. */
  guardando?: boolean
  /** Error al enviar la firma (lo muestra el panel). */
  error?: string | null
  /**
   * Si se indica, se recuerda en este navegador la última firma aplicada y, al abrir, se ofrece
   * volver a usarla (útil para el arrendador, que firma muchos contratos).
   */
  recordarClave?: string
}

type Modo = 'dibujar' | 'imagen'

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

function leerGuardada(clave?: string): string | null {
  if (!clave) return null
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

interface ControlLienzo {
  borrar: () => void
  obtenerPng: () => string | null
}

/** Lienzo para dibujar la firma con el dedo o el mouse. Solo existe mientras el modo es "dibujar". */
function LienzoFirma({
  controlRef,
  onVacio,
}: {
  controlRef: RefObject<ControlLienzo | null>
  onVacio: (vacio: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const densidad = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * densidad
    canvas.height = canvas.offsetHeight * densidad
    canvas.getContext('2d')?.scale(densidad, densidad)

    const pad = new SignaturePad(canvas, { penColor: '#0b2540', minWidth: 0.9, maxWidth: 2.8 })
    pad.addEventListener('endStroke', () => onVacio(pad.isEmpty()))
    controlRef.current = {
      borrar: () => {
        pad.clear()
        onVacio(true)
      },
      obtenerPng: () => (pad.isEmpty() ? null : recortarFirma(canvas)),
    }
    return () => {
      pad.off()
      controlRef.current = null
    }
  }, [controlRef, onVacio])

  return (
    <canvas
      ref={canvasRef}
      className="h-52 w-full rounded-xl border-2 border-dashed border-[#D4A437] bg-[#FFFDF8]"
      style={{ touchAction: 'none' }}
    />
  )
}

const FONDO_CUADRICULA = {
  backgroundImage:
    'linear-gradient(45deg,#f1f5f9 25%,transparent 25%,transparent 75%,#f1f5f9 75%),linear-gradient(45deg,#f1f5f9 25%,#fff 25%,#fff 75%,#f1f5f9 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
}

/**
 * Panel para dar la firma, de dos formas: dibujarla con el dedo/mouse o subir una imagen
 * (foto o escaneo; se le quita el fondo para que quede como una firma dibujada).
 */
export default function PanelFirma({
  onAplicar,
  onCancelar,
  titulo = 'Tu firma',
  descripcion,
  guardando = false,
  error = null,
  recordarClave,
}: Props) {
  const guardada = leerGuardada(recordarClave)
  const [modo, setModo] = useState<Modo>(guardada ? 'imagen' : 'dibujar')
  const [lienzoVacio, setLienzoVacio] = useState(true)
  const [imagenPng, setImagenPng] = useState<string | null>(guardada)
  const [esGuardada, setEsGuardada] = useState(guardada !== null)
  const [procesando, setProcesando] = useState(false)
  const [errorImagen, setErrorImagen] = useState<string | null>(null)
  const controlRef = useRef<ControlLienzo | null>(null)

  async function alElegirImagen(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setErrorImagen(null)
    if (!archivo.type.startsWith('image/')) {
      setErrorImagen('El archivo debe ser una imagen (PNG o JPG).')
      return
    }
    setProcesando(true)
    try {
      setImagenPng(await procesarImagenFirma(archivo))
      setEsGuardada(false)
    } catch (excepcion) {
      setImagenPng(null)
      setErrorImagen(excepcion instanceof Error ? excepcion.message : 'No se pudo leer la imagen.')
    }
    setProcesando(false)
  }

  function borrar() {
    if (modo === 'dibujar') controlRef.current?.borrar()
    else {
      setImagenPng(null)
      setErrorImagen(null)
    }
  }

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo)
    setErrorImagen(null)
    setLienzoVacio(true)
  }

  const puedeAplicar = modo === 'dibujar' ? !lienzoVacio : Boolean(imagenPng) && !procesando

  function aplicar() {
    const png = modo === 'dibujar' ? controlRef.current?.obtenerPng() : imagenPng
    if (!png) return
    if (recordarClave) {
      try {
        localStorage.setItem(recordarClave, png)
      } catch {
        // sin almacenamiento local: solo no se recuerda la firma
      }
    }
    onAplicar(png)
  }

  const botonModo = (valor: Modo, etiqueta: string) => (
    <button
      type="button"
      onClick={() => cambiarModo(valor)}
      aria-pressed={modo === valor}
      className={`flex-1 rounded-lg px-3 py-2.5 text-base font-semibold ${
        modo === valor ? 'bg-[#055741] text-white' : 'text-[#055741] hover:bg-[#055741]/10'
      }`}
    >
      {etiqueta}
    </button>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-[#055741]" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {descripcion ?? 'Dibújala con el dedo o el mouse, o sube una imagen de tu firma.'}
        </p>

        <div className="mt-3 flex gap-1 rounded-xl border border-[#055741]/30 p-1">
          {botonModo('dibujar', 'Dibujar')}
          {botonModo('imagen', 'Subir imagen')}
        </div>

        {modo === 'dibujar' ? (
          <div className="mt-3">
            <LienzoFirma controlRef={controlRef} onVacio={setLienzoVacio} />
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex h-52 items-center justify-center rounded-xl border-2 border-dashed border-[#D4A437]" style={FONDO_CUADRICULA}>
              {procesando && <span className="text-sm text-slate-500">Procesando…</span>}
              {!procesando && imagenPng && (
                <img src={imagenPng} alt="Vista previa de la firma" className="max-h-48 max-w-full" />
              )}
              {!procesando && !imagenPng && (
                <span className="px-4 text-center text-sm text-slate-500">
                  Elige una foto o escaneo de tu firma, con tinta oscura sobre fondo claro.
                </span>
              )}
            </div>
            {imagenPng && esGuardada && (
              <p className="mt-1 text-xs text-slate-500">Es la última firma que usaste en este navegador.</p>
            )}
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-[#055741] px-3 py-3 text-base font-semibold text-[#055741] active:bg-[#055741]/10">
              {imagenPng ? 'Cambiar imagen' : 'Elegir imagen'}
              <input type="file" accept="image/*" className="hidden" onChange={alElegirImagen} />
            </label>
          </div>
        )}

        {(errorImagen || error) && <p className="mt-3 text-sm font-medium text-red-700">{errorImagen ?? error}</p>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={borrar}
            disabled={guardando}
            className="rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="rounded-xl border border-slate-300 px-3 py-3 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={!puedeAplicar || guardando}
            className="rounded-xl bg-[#055741] px-3 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            {guardando ? 'Enviando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
