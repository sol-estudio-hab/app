import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EnlaceFirmante from '../components/firmas/EnlaceFirmante'
import { ETIQUETA_ESTADO_FIRMA, type FirmaContrato, type FirmaFirmante } from '../lib/firmas'
import { getSupabase } from '../lib/supabase'

type ContratoConFirmantes = FirmaContrato & {
  firma_firmantes: Pick<FirmaFirmante, 'id' | 'token' | 'nombre' | 'rol' | 'firmado_en'>[]
}

const CLASE_ESTADO: Record<FirmaContrato['estado'], string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  parcial: 'bg-amber-100 text-amber-800',
  completado: 'bg-green-100 text-green-800',
}

export default function FirmasAdmin() {
  const [contratos, setContratos] = useState<ContratoConFirmantes[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  async function cargar() {
    const { data, error: errorConsulta } = await getSupabase()
      .from('firma_contratos')
      .select('*, firma_firmantes(id, token, nombre, rol, firmado_en)')
      .order('creado_en', { ascending: false })
    if (errorConsulta) {
      setError('No se pudo cargar la lista de contratos.')
      return
    }
    setContratos((data as ContratoConFirmantes[]) ?? [])
  }

  useEffect(() => {
    cargar()
  }, [])

  async function abrirPdf(ruta: string) {
    setError(null)
    const { data, error: errorFirma } = await getSupabase().storage.from('firmas').createSignedUrl(ruta, 60)
    if (errorFirma || !data) {
      setError('No se pudo abrir el PDF.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function eliminar(contrato: ContratoConFirmantes) {
    if (
      !window.confirm(
        `¿Eliminar «${contrato.titulo}»? Se borran el PDF, las firmas y los enlaces, y no se puede deshacer.`,
      )
    ) {
      return
    }
    setError(null)
    setEliminando(contrato.id)
    const supabase = getSupabase()
    const { data: borrados, error: errorBorrar } = await supabase
      .from('firma_contratos')
      .delete()
      .eq('id', contrato.id)
      .select('id')
    if (errorBorrar || !borrados?.length) {
      setError('No se pudo eliminar el contrato.')
    } else {
      const rutas = [contrato.ruta_original, contrato.ruta_firmado].filter((r): r is string => Boolean(r))
      await supabase.storage.from('firmas').remove(rutas)
    }
    setEliminando(null)
    await cargar()
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-marca-900">Firmas de contratos</h1>
        <Link
          to="/admin/firmas/nueva"
          className="rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white hover:bg-marca-800"
        >
          Nuevo contrato
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!contratos && !error && <p className="mt-6 text-slate-500">Cargando…</p>}
      {contratos?.length === 0 && (
        <p className="mt-6 text-slate-500">Todavía no hay contratos para firmar.</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {contratos?.map((contrato) => (
          <div key={contrato.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{contrato.titulo}</p>
                <p className="text-xs text-slate-500">
                  {contrato.habitacion ? `Habitación ${contrato.habitacion} · ` : ''}
                  Creado el {new Date(contrato.creado_en).toLocaleDateString('es')}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CLASE_ESTADO[contrato.estado]}`}>
                {ETIQUETA_ESTADO_FIRMA[contrato.estado]}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {contrato.firma_firmantes.map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-100 p-2">
                  <p className="text-sm text-slate-800">
                    {f.nombre} <span className="capitalize text-slate-500">({f.rol})</span> ·{' '}
                    {f.firmado_en ? (
                      <span className="text-green-700">
                        Firmó el {new Date(f.firmado_en).toLocaleString('es')}
                      </span>
                    ) : (
                      <span className="text-amber-700">Pendiente de firma</span>
                    )}
                  </p>
                  {!f.firmado_en && (
                    <div className="mt-2">
                      <EnlaceFirmante nombre={f.nombre} token={f.token} habitacion={contrato.habitacion} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {contrato.ruta_firmado && (
                <button
                  type="button"
                  onClick={() => abrirPdf(contrato.ruta_firmado!)}
                  className="rounded-lg bg-marca-700 px-3 py-1.5 font-semibold text-white hover:bg-marca-800"
                >
                  {contrato.estado === 'completado' ? 'Descargar PDF firmado' : 'Descargar PDF (firmas hasta ahora)'}
                </button>
              )}
              <button
                type="button"
                onClick={() => abrirPdf(contrato.ruta_original)}
                className="text-marca-700 underline"
              >
                Ver original
              </button>
              <button
                type="button"
                onClick={() => eliminar(contrato)}
                disabled={eliminando === contrato.id}
                className="ml-auto text-red-600 underline disabled:opacity-60"
              >
                {eliminando === contrato.id ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
