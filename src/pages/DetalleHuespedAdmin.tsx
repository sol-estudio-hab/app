import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { estadoDelMes, estadoDeposito, formatearMes, generarMesesAcuerdo } from '../lib/calendario'
import { getSupabase } from '../lib/supabase'
import type { Acuerdo, Deposito, Huesped, Pago } from '../types/dominio'

export default function DetalleHuespedAdmin() {
  const { id } = useParams<{ id: string }>()
  const [huesped, setHuesped] = useState<Huesped | null>(null)
  const [acuerdo, setAcuerdo] = useState<Acuerdo | null>(null)
  const [pagos, setPagos] = useState<Pago[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [nombres, setNombres] = useState('')
  const [numeroHabitacion, setNumeroHabitacion] = useState('')
  const [activo, setActivo] = useState(true)
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [mesesAcuerdo, setMesesAcuerdo] = useState('')

  const [rechazandoMes, setRechazandoMes] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [rechazandoCargue, setRechazandoCargue] = useState<1 | 2 | null>(null)
  const [motivoRechazoDeposito, setMotivoRechazoDeposito] = useState('')

  async function cargar() {
    if (!id) return
    const supabase = getSupabase()
    const [huespedRes, acuerdoRes] = await Promise.all([
      supabase.from('huespedes').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('acuerdos')
        .select('*')
        .eq('huesped_id', id)
        .eq('estado', 'activo')
        .maybeSingle(),
    ])
    if (huespedRes.error) {
      setError(huespedRes.error.message)
      setCargando(false)
      return
    }
    const h = huespedRes.data as Huesped | null
    const a = acuerdoRes.data as Acuerdo | null
    setHuesped(h)
    setAcuerdo(a)
    if (h) {
      setNombres(h.nombres)
      setNumeroHabitacion(h.numero_habitacion)
      setActivo(h.activo)
    }
    if (a) {
      setFechaIngreso(a.fecha_ingreso)
      setMesesAcuerdo(String(a.meses_acuerdo))
      const [pagosRes, depositosRes] = await Promise.all([
        supabase.from('pagos').select('*').eq('acuerdo_id', a.id),
        supabase.from('depositos').select('*').eq('acuerdo_id', a.id),
      ])
      setPagos((pagosRes.data as Pago[]) ?? [])
      setDepositos((depositosRes.data as Deposito[]) ?? [])
    } else {
      setPagos([])
      setDepositos([])
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function guardarHuesped() {
    if (!huesped) return
    setError(null)

    if (acuerdo) {
      const meses = Number(mesesAcuerdo)
      if (!Number.isInteger(meses) || meses <= 0) {
        setError('El número de meses del acuerdo debe ser un entero mayor a 0.')
        return
      }
    }

    setGuardando(true)
    const supabase = getSupabase()
    const { error: errorHuesped } = await supabase
      .from('huespedes')
      .update({ nombres, numero_habitacion: numeroHabitacion, activo })
      .eq('id', huesped.id)

    let errorAcuerdo: string | null = null
    if (acuerdo) {
      const resultado = await supabase
        .from('acuerdos')
        .update({ fecha_ingreso: fechaIngreso, meses_acuerdo: Number(mesesAcuerdo) })
        .eq('id', acuerdo.id)
      errorAcuerdo = resultado.error?.message ?? null
    }

    setGuardando(false)
    if (errorHuesped || errorAcuerdo) {
      setError('No se pudieron guardar los cambios.')
      return
    }
    await cargar()
  }

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

  async function verificarPago(pago: Pago) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorVerificar } = await getSupabase()
      .from('pagos')
      .update({
        estado: 'verificado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
      })
      .eq('id', pago.id)
    if (errorVerificar) setError('No se pudo verificar el pago.')
    await cargar()
  }

  async function confirmarRechazo(pago: Pago) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorRechazar } = await getSupabase()
      .from('pagos')
      .update({
        estado: 'rechazado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
        observaciones: motivoRechazo || 'Comprobante rechazado por el administrador.',
      })
      .eq('id', pago.id)
    if (errorRechazar) setError('No se pudo rechazar el pago.')
    setRechazandoMes(null)
    setMotivoRechazo('')
    await cargar()
  }

  async function verificarDeposito(deposito: Deposito) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorVerificar } = await getSupabase()
      .from('depositos')
      .update({
        estado: 'verificado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
      })
      .eq('id', deposito.id)
    if (errorVerificar) setError('No se pudo verificar el depósito.')
    await cargar()
  }

  async function confirmarRechazoDeposito(deposito: Deposito) {
    setError(null)
    const {
      data: { user },
    } = await getSupabase().auth.getUser()
    if (!user) return
    const { error: errorRechazar } = await getSupabase()
      .from('depositos')
      .update({
        estado: 'rechazado',
        verificado_por: user.id,
        fecha_verificacion: new Date().toISOString(),
        observaciones: motivoRechazoDeposito || 'Comprobante rechazado por el administrador.',
      })
      .eq('id', deposito.id)
    if (errorRechazar) setError('No se pudo rechazar el depósito.')
    setRechazandoCargue(null)
    setMotivoRechazoDeposito('')
    await cargar()
  }

  if (cargando) return <p className="mt-8 text-center text-slate-500">Cargando…</p>
  if (!huesped) return <p className="mt-8 text-center text-slate-500">Huésped no encontrado.</p>

  const meses = acuerdo ? generarMesesAcuerdo(acuerdo.fecha_ingreso, acuerdo.meses_acuerdo) : []

  return (
    <section>
      <h1 className="text-xl font-bold text-marca-900">{huesped.nombres}</h1>
      <p className="text-sm text-slate-600">{huesped.correo}</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nombres
          <input
            value={nombres}
            onChange={(e) => setNombres(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Número de habitación
          <input
            value={numeroHabitacion}
            onChange={(e) => setNumeroHabitacion(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
          />
        </label>

        {acuerdo && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Fecha de ingreso (define el día de pago)
              <input
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Meses del acuerdo
              <input
                type="number"
                min={1}
                value={mesesAcuerdo}
                onChange={(e) => setMesesAcuerdo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
              />
            </label>
          </>
        )}

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Cuenta activa
        </label>

        <button
          type="button"
          onClick={guardarHuesped}
          disabled={guardando}
          className="rounded-lg bg-marca-700 px-4 py-2 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60 sm:col-span-2 sm:w-fit"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {acuerdo && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Depósito de garantía</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([1, 2] as const).map((numeroCargue) => {
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

                  {deposito?.archivo_url && (
                    <button
                      type="button"
                      onClick={() => verComprobante(deposito.archivo_url!)}
                      className="w-fit text-sm text-marca-700 underline"
                    >
                      Ver comprobante
                    </button>
                  )}

                  {deposito?.estado === 'cargado' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => verificarDeposito(deposito)}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Verificar
                      </button>
                      {rechazandoCargue === numeroCargue ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={motivoRechazoDeposito}
                            onChange={(e) => setMotivoRechazoDeposito(e.target.value)}
                            placeholder="Motivo del rechazo"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => confirmarRechazoDeposito(deposito)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Confirmar rechazo
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRechazandoCargue(numeroCargue)}
                          className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                  )}

                  {deposito?.estado === 'rechazado' && deposito.observaciones && (
                    <p className="text-xs text-red-600">Motivo: {deposito.observaciones}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {acuerdo ? (
        <div className="mt-6 flex flex-col gap-3">
          {meses.map(({ mes, vencimiento }) => {
            const pago = pagos.find((p) => p.mes_pagado === mes)
            const estado = estadoDelMes(vencimiento, pago)
            return (
              <div key={mes} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{formatearMes(mes)}</p>
                    <p className="text-xs text-slate-500">
                      Vence el {vencimiento.toLocaleDateString('es')}
                    </p>
                  </div>
                  <EstadoPagoBadge estado={estado} />
                </div>

                {pago?.archivo_url && (
                  <button
                    type="button"
                    onClick={() => verComprobante(pago.archivo_url!)}
                    className="w-fit text-sm text-marca-700 underline"
                  >
                    Ver comprobante
                  </button>
                )}

                {pago?.estado === 'cargado' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => verificarPago(pago)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Verificar
                    </button>
                    {rechazandoMes === mes ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={motivoRechazo}
                          onChange={(e) => setMotivoRechazo(e.target.value)}
                          placeholder="Motivo del rechazo"
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => confirmarRechazo(pago)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Confirmar rechazo
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRechazandoMes(mes)}
                        className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                )}

                {pago?.estado === 'rechazado' && pago.observaciones && (
                  <p className="text-xs text-red-600">Motivo: {pago.observaciones}</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-6 text-slate-600">Este huésped no tiene un acuerdo activo.</p>
      )}
    </section>
  )
}
