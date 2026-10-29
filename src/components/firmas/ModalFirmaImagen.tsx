import { type ChangeEvent, useState } from 'react'
import { procesarImagenFirma } from '../../lib/imagenFirma'

const CLAVE_FIRMA_GUARDADA = 'sol-firma-arrendador'

function leerFirmaGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE_FIRMA_GUARDADA)
  } catch {
    return null
  }
}

interface Props {
  nombre: string
  guardando: boolean
  error: string | null
  onAplicar: (firmaPng: string) => void
  onCancelar: () => void
}

/**
 * Cuadro para cargar la imagen de la firma del arrendador. Quita el fondo claro (queda como una
 * firma dibujada) y muestra cómo se verá. Recuerda la última firma usada en este navegador para
 * no tener que subirla en cada contrato.
 */
export default function ModalFirmaImagen({ nombre, guardando, error, onAplicar, onCancelar }: Props) {
  const [firma, setFirma] = useState<string | null>(leerFirmaGuardada)
  const [procesando, setProcesando] = useState(false)
  const [errorImagen, setErrorImagen] = useState<string | null>(null)
  const [esGuardada, setEsGuardada] = useState(() => leerFirmaGuardada() !== null)

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
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
      setFirma(await procesarImagenFirma(archivo))
      setEsGuardada(false)
    } catch (excepcion) {
      setFirma(null)
      setErrorImagen(excepcion instanceof Error ? excepcion.message : 'No se pudo leer la imagen.')
    }
    setProcesando(false)
  }

  function aplicar() {
    if (!firma) return
    try {
      localStorage.setItem(CLAVE_FIRMA_GUARDADA, firma)
    } catch {
      // sin almacenamiento local: solo no se recuerda la firma
    }
    onAplicar(firma)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-marca-900">Firma del arrendador</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sube una imagen de la firma de <strong>{nombre}</strong> (foto o escaneo, tinta oscura sobre fondo
          claro). Se estampará en su recuadro del PDF.
        </p>

        <div
          className="mt-4 flex h-36 items-center justify-center rounded-lg border border-slate-300"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#f1f5f9 25%,transparent 25%,transparent 75%,#f1f5f9 75%),linear-gradient(45deg,#f1f5f9 25%,#fff 25%,#fff 75%,#f1f5f9 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 8px 8px',
          }}
        >
          {procesando && <span className="text-sm text-slate-500">Procesando…</span>}
          {!procesando && firma && <img src={firma} alt="Vista previa de la firma" className="max-h-32 max-w-full" />}
          {!procesando && !firma && <span className="text-sm text-slate-400">Aún no hay imagen</span>}
        </div>
        {firma && esGuardada && <p className="mt-1 text-xs text-slate-500">Es la última firma que usaste en este navegador.</p>}

        <label className="mt-3 inline-block cursor-pointer rounded-lg border border-marca-700 px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50">
          {firma ? 'Cambiar imagen' : 'Elegir imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={alElegir} />
        </label>

        {(errorImagen || error) && <p className="mt-3 text-sm text-red-600">{errorImagen ?? error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={!firma || procesando || guardando}
            className="rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800 disabled:opacity-60"
          >
            {guardando ? 'Aplicando…' : 'Aplicar firma'}
          </button>
        </div>
      </div>
    </div>
  )
}
