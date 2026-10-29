import { Link } from 'react-router-dom'
import { type OpcionMenu } from '../lib/menu'
import IconoMenu from './IconoMenu'

/** Cuadrícula de tarjetas del menú principal: icono y título arriba, descripción sobre fondo suave abajo. */
export default function MenuOpciones({ opciones }: { opciones: OpcionMenu[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {opciones.map((opcion) => (
        <li key={opcion.id} className="flex">
          <Link
            to={opcion.to}
            className="group flex w-full flex-col overflow-hidden rounded-md border border-marca-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-600"
          >
            <span className="flex flex-col items-center gap-3 px-4 pb-4 pt-6">
              <IconoMenu id={opcion.id} />
              <span className="text-center text-lg text-marca-900">{opcion.titulo}</span>
            </span>
            <span className="flex-1 border-t border-marca-100 bg-marca-50 px-4 py-4 text-sm leading-relaxed text-slate-600 group-hover:bg-marca-100/60">
              {opcion.descripcion}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
