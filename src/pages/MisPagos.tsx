import { useEffect, useState } from 'react'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { useAuth } from '../context/AuthContext'
import { TAMANO_MAXIMO_BYTES, TIPOS_PERMITIDOS, extensionParaMime } from '../lib/archivos'
import { estadoDelMes, estadoDeposito, formatearMes, generarMesesAcuerdo } from '../lib/calendario'
import { HABITACIONES } from '../lib/habitaciones'
import { getSupabase } from '../lib/supabase'
import type { Deposito, Pago } from '../types/dominio'

export default function MisPagos() {
  const { huesped, acuerdoActivo, recargarPerfil } = useAuth()
  const [pagos, setPagos] = useState<Pago[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subiendoMes, setSubiendoMes] = useState<string | null>(null)
  const [subiendoCargue, setSubiendoCargue] = useState<1 | 2 | null>(null)

  const [numeroHabitacionNuevo, setNumeroHabitacionNuevo] = useState('')
  const [fechaIngresoNuevo, setFechaIngresoNuevo] = useState('')
  const [mesesAcuerdoNuevo, setMesesAcuerdoNuevo] = useState('')
  const [creandoAcuerdo, setCreandoAcuerdo] = useState(false)
  const [errorNuevoAcuerdo, setErrorNuevoAcuerdo] = useState<string | null>(null)
  const [habitacionesDisponibles, setHabitacionesDisponibles] = useState<string[]>([])
  const [cargandoHabitaciones, setCargandoHabitaciones] = useState(true)

  async function cargarPagos() {
    if (!acuerdoActivo) return
    const supabase = getSupabase()
    const [pagosRes, depositosRes] = await Promise.all([
      supabase.from('pagos').select('*').eq('acuerdo_id', acuerdoActivo.id),
      supabase.from('depositos').select('*').eq('acuerdo_id', acuerdoActivo.id),
    ])
    if (pagosRes.error) setError(pagosRes.error.message)
    else setPagos((pagosRes.data as Pago[]) ?? [])
    setDepositos((depositosRes.data as Deposito[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargarPagos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acuerdoActivo?.id])

  useEffect(() => {
    if (acuerdoActivo || !huesped) return
    let cancelado = false
    setCargandoHabitaciones(true)
    getSupabase()
      .rpc('habitaciones_ocupadas')
      .then(({ data, error: errorRpc }) => {
        if (cancelado) return
        const ocupadas = new Set(errorRpc ? [] : ((data as string[] | null) ?? []))
        setHabitacionesDisponibles(HABITACIONES.filter((h) => !ocupadas.has(h)))
        setCargandoHabitaciones(false)
      })
    return () => {
      cancelado = true
    }
  }, [acuerdoActivo, huesped])

  async function crearNuevoAcuerdo() {
    if (!huesped) return
    setErrorNuevoAcuerdo(null)
    if (!numeroHabitacionNuevo) {
      setErrorNuevoAcuerdo('Selecciona una habitación.')
      return
    }
    if (!fechaIngresoNuevo) {
      setErrorNuevoAcuerdo('La fecha de ingreso es obligatoria.')
      return
    }
    const meses = Number(mesesAcuerdoNuevo)
    if (!Number.isInteger(meses) || meses <= 0) {
      setErrorNuevoAcuerdo('El número de meses del acuerdo debe ser un entero mayor a 0.')
      return
    }

    setCreandoAcuerdo(true)
    const supabase = getSupabase()
    const { error: errorHuesped } = await supabase
      .from('huespedes')
      .update({ numero_habitacion: numeroHabitacionNuevo, activo: true })
      .eq('id', huesped.id)
    if (errorHuesped) {
      setCreandoAcuerdo(false)
      setErrorNuevoAcuerdo('No se pudo guardar la habitación. Intenta de nuevo.')
      return
    }

    const { error: errorInsertar } = await supabase.from('acuerdos').insert({
      huesped_id: huesped.id,
      fecha_ingreso: fechaIngresoNuevo,
      meses_acuerdo: meses,
    })
    setCreandoAcuerdo(false)
    if (errorInsertar) {
      setErrorNuevoAcuerdo(
        'No se pudo crear el nuevo acuerdo. Es posible que la habitación ya no esté disponible — elige otra e intenta de nuevo.',
      )
      return
    }
    setNumeroHabitacionNuevo('')
    setFechaIngresoNuevo('')
    setMesesAcuerdoNuevo('')
    await recargarPerfil()
  }

  if (!huesped) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Mis pagos</h1>
        <p className="mt-3 text-slate-600">
          Esta cuenta no tiene un perfil de huésped asociado.
        </p>
      </section>
    )
  }

  if (!acuerdoActivo) {
    return (
      <section className="mx-auto max-w-md">
        <h1 className="text-center text-xl font-bold text-marca-900">Mis pagos</h1>
        <p className="mt-3 text-center text-slate-600">
          No tienes un acuerdo activo. Si vas a continuar tu estadía, ingresa los datos de tu
          nuevo acuerdo.
        </p>

        <div className="mt-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Número de habitación
            <select
              value={numeroHabitacionNuevo}
              onChange={(e) => setNumeroHabitacionNuevo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
            >
              <option value="">
                {cargandoHabitaciones ? 'Cargando habitaciones…' : 'Selecciona una habitación'}
              </option>
              {habitacionesDisponibles.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            {!cargandoHabitaciones && habitacionesDisponibles.length === 0 && (
              <span className="text-xs text-red-600">
                No hay habitaciones disponibles en este momento. Contacta al administrador.
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Fecha de ingreso (igual a la del nuevo acuerdo firmado)
            <input
              type="date"
              value={fechaIngresoNuevo}
              onChange={(e) => setFechaIngresoNuevo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Número de meses del acuerdo
            <input
              type="number"
              min={1}
              value={mesesAcuerdoNuevo}
              onChange={(e) => setMesesAcuerdoNuevo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
            />
          </label>

          {errorNuevoAcuerdo && <p className="text-sm text-red-600">{errorNuevoAcuerdo}</p>}

          <button
            type="button"
            onClick={crearNuevoAcuerdo}
            disabled={creandoAcuerdo || cargandoHabitaciones || habitacionesDisponibles.length === 0}
            className="rounded-lg bg-marca-700 px-4 py-2 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
          >
            {creandoAcuerdo ? 'Creando…' : 'Crear nuevo acuerdo'}
          </button>
        </div>
      </section>
    )
  }

  if (cargando) {
    return <p className="mt-8 text-center text-slate-500">Cargando tus pagos…</p>
  }

  const meses = generarMesesAcuerdo(acuerdoActivo.fecha_ingreso, acuerdoActivo.meses_acuerdo)

  async function verArchivo(archivoUrl: string) {
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

  async function subirDeposito(
    numeroCargue: 1 | 2,
    depositoExistente: Deposito | undefined,
    archivo: File,
  ) {
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
      depositoExistente?.archivo_url &&
      !window.confirm(
        `Ya cargaste un comprobante para el cargue ${numeroCargue} del depósito. ¿Deseas reemplazarlo?`,
      )
    ) {
      return
    }

    setSubiendoCargue(numeroCargue)
    const supabase = getSupabase()
    const extension = extensionParaMime(archivo.type)
    const ruta = `${huesped!.id}/deposito-${numeroCargue}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('comprobantes')
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type })

    if (errorSubida) {
      setError('No se pudo subir el archivo. Intenta de nuevo.')
      setSubiendoCargue(null)
      return
    }

    const datosDeposito = {
      archivo_url: ruta,
      estado: 'cargado' as const,
      fecha_carga: new Date().toISOString(),
      verificado_por: null,
      fecha_verificacion: null,
      observaciones: null,
    }

    const { error: errorGuardar } = depositoExistente
      ? await supabase.from('depositos').update(datosDeposito).eq('id', depositoExistente.id)
      : await supabase.from('depositos').insert({
          acuerdo_id: acuerdoActivo!.id,
          numero_cargue: numeroCargue,
          ...datosDeposito,
        })

    if (errorGuardar) setError('No se pudo registrar el depósito.')

    setSubiendoCargue(null)
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

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Depósito de garantía</h2>
        <p className="mt-1 text-xs text-slate-500">
          Comprobante del depósito, independiente de los pagos mensuales. Se puede cargar en hasta
          2 pagos.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(acuerdoActivo.deposito_pago_unico ? ([1] as const) : ([1, 2] as const)).map((numeroCargue) => {
            const deposito = depositos.find((d) => d.numero_cargue === numeroCargue)
            const estado = estadoDeposito(deposito?.estado)
            return (
              <div
                key={numeroCargue}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Cargue {numeroCargue}</p>
                  <EstadoPagoBadge estado={estado} />
                </div>

                {deposito?.estado === 'rechazado' && deposito.observaciones && (
                  <p className="text-xs text-red-600">Motivo: {deposito.observaciones}</p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {deposito?.archivo_url && (
                    <button
                      type="button"
                      onClick={() => verArchivo(deposito.archivo_url!)}
                      className="text-sm text-marca-700 underline"
                    >
                      Ver comprobante
                    </button>
                  )}

                  {estado !== 'verificado' && (
                    <label className="cursor-pointer rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800">
                      {subiendoCargue === numeroCargue
                        ? 'Subiendo…'
                        : deposito?.archivo_url
                          ? 'Reemplazar'
                          : 'Subir comprobante'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={subiendoCargue !== null}
                        onChange={(evento) => {
                          const archivo = evento.target.files?.[0]
                          evento.target.value = ''
                          if (archivo) subirDeposito(numeroCargue, deposito, archivo)
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
                    onClick={() => verArchivo(pago.archivo_url!)}
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
