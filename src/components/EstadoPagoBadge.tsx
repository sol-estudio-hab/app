import { ETIQUETA_ESTADO_MES, type EstadoMes } from '../lib/calendario'

const CLASES: Record<EstadoMes, string> = {
  verificado: 'bg-green-100 text-green-800',
  en_revision: 'bg-amber-100 text-amber-800',
  rechazado: 'bg-red-100 text-red-800',
  pendiente: 'bg-slate-100 text-slate-700',
  vencido: 'bg-red-100 text-red-800',
}

export default function EstadoPagoBadge({ estado }: { estado: EstadoMes }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CLASES[estado]}`}>
      {ETIQUETA_ESTADO_MES[estado]}
    </span>
  )
}
