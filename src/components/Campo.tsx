interface Props {
  etiqueta: string
  tipo: string
  valor: string
  onCambio: (valor: string) => void
  autoComplete?: string
  min?: number
  opcional?: boolean
}

export default function Campo({ etiqueta, tipo, valor, onCambio, autoComplete, min, opcional }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {etiqueta}
      {opcional && <span className="font-normal text-slate-400"> (opcional)</span>}
      <input
        type={tipo}
        value={valor}
        min={min}
        autoComplete={autoComplete}
        required={!opcional}
        onChange={(evento) => onCambio(evento.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900 focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
      />
    </label>
  )
}
