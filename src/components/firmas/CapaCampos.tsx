import { type PointerEvent, useRef, useState } from 'react'
import {
  type CampoFirma,
  type RectPantalla,
  TAMANO_MINIMO_CAMPO_PX,
  campoARectPantalla,
  limitarRect,
  rectEntrePuntos,
  rectPantallaACampo,
} from '../../lib/firmas'
import type { InfoPagina } from './VisorPdf'

export interface CampoEditable extends CampoFirma {
  id: string
  firmanteId: string
}

export interface FirmanteEditable {
  id: string
  nombre: string
  color: string
}

interface Props {
  info: InfoPagina
  campos: CampoEditable[]
  firmantes: FirmanteEditable[]
  /** Firmante al que se asigna la próxima casilla dibujada. */
  activoId: string | null
  /** Si es false la capa deja pasar el desplazamiento táctil (para moverse por el PDF). */
  dibujar: boolean
  onAgregar: (pagina: number, campo: Omit<CampoFirma, 'pagina'>) => void
  onQuitar: (id: string) => void
}

/** Capa sobre una página del PDF donde el administrador dibuja arrastrando las casillas de firma. */
export default function CapaCampos({ info, campos, firmantes, activoId, dibujar, onAgregar, onQuitar }: Props) {
  const capaRef = useRef<HTMLDivElement>(null)
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null)
  const [borrador, setBorrador] = useState<RectPantalla | null>(null)

  function punto(e: PointerEvent): { x: number; y: number } {
    const caja = capaRef.current!.getBoundingClientRect()
    return { x: e.clientX - caja.left, y: e.clientY - caja.top }
  }

  function alPresionar(e: PointerEvent) {
    if (!dibujar || !activoId || e.target !== e.currentTarget) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setInicio(punto(e))
  }

  function alMover(e: PointerEvent) {
    if (!inicio || !capaRef.current) return
    const p = punto(e)
    const caja = capaRef.current.getBoundingClientRect()
    setBorrador(limitarRect(rectEntrePuntos(inicio.x, inicio.y, p.x, p.y), caja.width, caja.height))
  }

  function alSoltar() {
    if (borrador && borrador.width >= TAMANO_MINIMO_CAMPO_PX && borrador.height >= TAMANO_MINIMO_CAMPO_PX) {
      onAgregar(info.numero, rectPantallaACampo(borrador, info.escala, info.altoPts))
    }
    setInicio(null)
    setBorrador(null)
  }

  const colorActivo = firmantes.find((f) => f.id === activoId)?.color ?? '#055741'

  return (
    <div
      ref={capaRef}
      className="absolute inset-0"
      style={{ touchAction: dibujar ? 'none' : 'auto', cursor: dibujar && activoId ? 'crosshair' : 'default' }}
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
    >
      {campos
        .filter((c) => c.pagina === info.numero)
        .map((campo) => {
          const r = campoARectPantalla(campo, info.escala, info.altoPts)
          const firmante = firmantes.find((f) => f.id === campo.firmanteId)
          const color = firmante?.color ?? '#555'
          return (
            <div
              key={campo.id}
              className="absolute flex items-start justify-between overflow-hidden rounded border-2 text-[11px] font-semibold"
              style={{
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                borderColor: color,
                backgroundColor: `${color}22`,
                color,
              }}
            >
              <span className="truncate px-1">{firmante?.nombre || 'Firmante'}</span>
              <button
                type="button"
                aria-label="Quitar casilla"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onQuitar(campo.id)}
                className="px-1.5 text-base leading-none"
              >
                ×
              </button>
            </div>
          )
        })}

      {borrador && (
        <div
          className="pointer-events-none absolute rounded border-2 border-dashed"
          style={{
            left: borrador.left,
            top: borrador.top,
            width: borrador.width,
            height: borrador.height,
            borderColor: colorActivo,
            backgroundColor: `${colorActivo}22`,
          }}
        />
      )}
    </div>
  )
}
