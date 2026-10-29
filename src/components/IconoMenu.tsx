import type { ReactNode } from 'react'
import type { IconoId } from '../lib/menu'

const GLIFOS: Record<IconoId, ReactNode> = {
  panel: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  nuevo: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M19 7.5v6M16 10.5h6" />
    </>
  ),
  firmas: (
    <>
      <path d="M4 19.5l1-4L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5l-4 1z" />
      <path d="M13 21h8" />
    </>
  ),
  reportes: (
    <>
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="5" width="4" height="15" rx="1" />
      <rect x="16" y="9" width="4" height="11" rx="1" />
    </>
  ),
  pagos: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5v.01M17.5 14.5v.01" />
    </>
  ),
  notificaciones: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
}

/** Icono circular de las tarjetas del menú: glifo blanco sobre un círculo del color de la marca. */
export default function IconoMenu({ id }: { id: IconoId }) {
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-700 text-white"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLIFOS[id]}
      </svg>
    </span>
  )
}
