import { useState } from 'react'
import { enlaceFirma, mensajeWhatsappFirma, origenFirmas } from '../../lib/firmas'
import { copiarTexto } from '../../lib/portapapeles'

interface Props {
  nombre: string
  token: string
  habitacion: string | null
}

/** Enlace de firma de un firmante, con botones para copiarlo o copiar el mensaje listo para WhatsApp. */
export default function EnlaceFirmante({ nombre, token, habitacion }: Props) {
  const [copiado, setCopiado] = useState<'enlace' | 'mensaje' | null>(null)
  const enlace = enlaceFirma(token, origenFirmas())

  async function copiar(tipo: 'enlace' | 'mensaje') {
    const texto = tipo === 'enlace' ? enlace : mensajeWhatsappFirma(nombre, habitacion, enlace)
    if (await copiarTexto(texto)) {
      setCopiado(tipo)
      setTimeout(() => setCopiado(null), 2000)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => copiar('enlace')}
        className="rounded-lg border border-marca-700 px-3 py-1.5 text-sm font-semibold text-marca-700 hover:bg-marca-50"
      >
        {copiado === 'enlace' ? '¡Copiado!' : 'Copiar enlace'}
      </button>
      <button
        type="button"
        onClick={() => copiar('mensaje')}
        className="rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800"
      >
        {copiado === 'mensaje' ? '¡Copiado!' : 'Copiar mensaje de WhatsApp'}
      </button>
    </div>
  )
}
