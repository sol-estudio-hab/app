import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

export interface ItemHamburguesa {
  to: string
  etiqueta: string
  /** Contador opcional (p. ej. notificaciones sin leer). */
  contador?: number
}

interface Props {
  abierto: boolean
  onAlternar: () => void
  onCerrar: () => void
  items: ItemHamburguesa[]
  /** Acción final separada del resto (p. ej. "Cerrar sesión"). */
  accion?: { etiqueta: string; onClick: () => void }
  /** Punto de aviso sobre el botón cerrado (hay algo pendiente en el menú). */
  aviso?: boolean
}

/** Botón de hamburguesa con menú desplegable; se cierra al tocar fuera o con Escape. */
export default function MenuHamburguesa({ abierto, onAlternar, onCerrar, items, accion, aviso }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alPresionar = (evento: PointerEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) onCerrar()
    }
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('pointerdown', alPresionar)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('pointerdown', alPresionar)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto, onCerrar])

  return (
    <div ref={contenedorRef} className="relative ml-auto">
      <button
        type="button"
        onClick={onAlternar}
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={abierto}
        aria-controls="menu-hamburguesa"
        className="relative flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/10"
      >
        <span
          className={`h-0.5 w-6 rounded-full bg-white transition-transform ${abierto ? 'translate-y-2 rotate-45' : ''}`}
        />
        <span className={`h-0.5 w-6 rounded-full bg-white transition-opacity ${abierto ? 'opacity-0' : ''}`} />
        <span
          className={`h-0.5 w-6 rounded-full bg-white transition-transform ${abierto ? '-translate-y-2 -rotate-45' : ''}`}
        />
        {aviso && !abierto && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-sol-500 ring-2 ring-marca-700" />
        )}
      </button>

      {abierto && (
        <nav
          id="menu-hamburguesa"
          aria-label="Menú principal"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-lg bg-white py-1 text-sm text-slate-800 shadow-xl ring-1 ring-black/10"
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onCerrar}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-marca-50"
            >
              {item.etiqueta}
              {item.contador ? (
                <span className="rounded-full bg-sol-500 px-1.5 py-0.5 text-xs font-semibold text-slate-900">
                  {item.contador}
                </span>
              ) : null}
            </Link>
          ))}
          {accion && (
            <button
              type="button"
              onClick={accion.onClick}
              className="mt-1 block w-full border-t border-slate-200 px-4 py-2.5 text-left hover:bg-marca-50"
            >
              {accion.etiqueta}
            </button>
          )}
        </nav>
      )}
    </div>
  )
}
