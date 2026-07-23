import { useEffect, useState } from 'react'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { useAuth } from '../context/AuthContext'
import { TAMANO_MAXIMO_BYTES, TIPOS_PERMITIDOS, extensionParaMime } from '../lib/archivos'
import { estadoDelMes, formatearMes, generarMesesAcuerdo } from '../lib/calendario'
import { getSupabase } from '../lib/supabase'
import type { Pago } from '../types/dominio'

export default function MisPagos() {
  const { huesped, acuerdoActivo } = useAuth()
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subiendoMes, setSubiendoMes] = useState<string | null>(null)

  async function cargarPagos() {
    if (!acuerdoActivo) return
    const { data, error: errorConsulta } = await getSupabase()
      .from('pagos')
      .select('*')
      .eq('acuerdo_id', acuerdoActivo.id)
    if (errorConsulta) setError(errorConsulta.message)
    else setPagos((data as Pago[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargarPagos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acuerdoActivo?.id])

  if (!acuerdoActivo || !huesped) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Mis pagos</h1>
        <p className="mt-3 text-slate-600">
          No tienes un acuerdo activo. Contacta al administrador.
        </p>
      </section>
    )
  }

  if (cargando) {
    return <p className="mt-8 text-center text-slate-500">Cargando tus pagos…</p>
  }

  const meses = generarMesesAcuerdo(acuerdoActivo.fecha_ingreso, acuerdoActivo.meses_acuerdo)

  async function verComprobante(archivoUrl: string) {
    const { data, error: errorFirma } = await getSupabase()
      .storage.from('comprobantes')
      .createSignedUrl(archivoUrl, 60)
    if (errorFirma || !data) {
      setError('No se pudo abrir el comprobante.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function subirComprobante(mes: string, pagoExistente: Pago | undefined, archivo: File) {
    setError(null)
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      setError('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF.')
      return
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setError('El archivo supera el tamaño máximo de 10 MB.')
      return
    }
    if (
      pagoExistente?.archivo_url &&
      !window.confirm('Ya cargaste un comprobante para este mes. ¿Deseas reemplazarlo?')
    ) {
      return
    }

    setSubiendoMes(mes)
    const supabase = getSupabase()
    const extension = extensionParaMime(archivo.type)
    const ruta = `${huesped!.id}/${mes}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('comprobantes')
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type })

    if (errorSubida) {
      setError('No se pudo subir el archivo. Intenta de nuevo.')
      setSubiendoMes(null)
      return
    }

    const datosPago = {
      archivo_url: ruta,
      estado: 'cargado' as const,
      fecha_carga: new Date().toISOString(),
      verificado_por: null,
      fecha_verificacion: null,
      observaciones: null,
    }

    const { error: errorGuardar } = pagoExistente
      ? await supabase.from('pagos').update(datosPago).eq('id', pagoExistente.id)
      : await supabase.from('pagos').insert({
          acuerdo_id: acuerdoActivo!.id,
          mes_pagado: mes,
          ...datosPago,
        })

    if (errorGuardar) setError('No se pudo registrar el pago.')

    setSubiendoMes(null)
    await cargarPagos()
  }

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">Mis pagos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Habitación {huesped.numero_habitacion} · Acuerdo desde el{' '}
        {new Date(`${acuerdoActivo.fecha_ingreso}T00:00:00`).toLocaleDateString('es')}
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {meses.map(({ mes, vencimiento }) => {
          const pago = pagos.find((p) => p.mes_pagado === mes)
          const estado = estadoDelMes(vencimiento, pago)
          return (
            <div
              key={mes}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{formatearMes(mes)}</p>
                <p className="text-xs text-slate-500">
                  Vence el {vencimiento.toLocaleDateString('es')}
                </p>
                {pago?.estado === 'rechazado' && pago.observaciones && (
                  <p className="mt-1 text-xs text-red-600">Motivo: {pago.observaciones}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <EstadoPagoBadge estado={estado} />

                {pago?.archivo_url && (
                  <button
                    type="button"
                    onClick={() => verComprobante(pago.archivo_url!)}
                    className="text-sm text-marca-700 underline"
                  >
                    Ver comprobante
                  </button>
                )}

                {estado !== 'verificado' && (
                  <label className="cursor-pointer rounded-lg bg-marca-700 px-3 py-2 text-sm font-semibold text-white hover:bg-marca-800">
                    {subiendoMes === mes
                      ? 'Subiendo…'
                      : pago?.archivo_url
                        ? 'Reemplazar'
                        : 'Subir comprobante'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      disabled={subiendoMes !== null}
                      onChange={(evento) => {
                        const archivo = evento.target.files?.[0]
                        evento.target.value = ''
                        if (archivo) subirComprobante(mes, pago, archivo)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
