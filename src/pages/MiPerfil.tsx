import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { diaDePago, mesesTranscurridos } from '../lib/fechas'
import { getSupabase } from '../lib/supabase'

export default function MiPerfil() {
  const { huesped, acuerdoActivo, recargarPerfil } = useAuth()

  const [editando, setEditando] = useState(false)
  const [nombres, setNombres] = useState(huesped?.nombres ?? '')
  const [numeroWhatsapp, setNumeroWhatsapp] = useState(huesped?.numero_whatsapp ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!huesped) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Mi perfil</h1>
        <p className="mt-3 text-slate-600">
          Esta cuenta no tiene un perfil de huésped asociado.
        </p>
      </section>
    )
  }

  function iniciarEdicion() {
    setNombres(huesped!.nombres)
    setNumeroWhatsapp(huesped!.numero_whatsapp ?? '')
    setError(null)
    setEditando(true)
  }

  async function guardarPerfil() {
    setError(null)
    if (!nombres.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    setGuardando(true)
    const { error: errorGuardar } = await getSupabase()
      .from('huespedes')
      .update({ nombres: nombres.trim(), numero_whatsapp: numeroWhatsapp.trim() || null })
      .eq('id', huesped!.id)
    setGuardando(false)
    if (errorGuardar) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    await recargarPerfil()
    setEditando(false)
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Mi perfil</h1>

      <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <dt className="shrink-0 text-slate-500">Nombres</dt>
          {editando ? (
            <div className="flex flex-1 items-center justify-end gap-2">
              <input
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-right font-medium text-slate-900 focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
              />
            </div>
          ) : (
            <dd className="font-medium text-slate-900">{huesped.nombres}</dd>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <dt className="shrink-0 text-slate-500">WhatsApp</dt>
          {editando ? (
            <div className="flex flex-1 items-center justify-end gap-2">
              <input
                type="tel"
                value={numeroWhatsapp}
                onChange={(e) => setNumeroWhatsapp(e.target.value)}
                placeholder="Sin registrar"
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-right font-medium text-slate-900 focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
              />
            </div>
          ) : (
            <dd className="font-medium text-slate-900">
              {huesped.numero_whatsapp || 'Sin registrar'}
            </dd>
          )}
        </div>

        {editando ? (
          <div className="flex justify-end gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarPerfil}
              disabled={guardando}
              className="rounded-lg bg-marca-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-800 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        ) : (
          <div className="flex justify-end px-4 py-2">
            <button
              type="button"
              onClick={iniciarEdicion}
              className="text-xs font-semibold text-marca-700 underline"
            >
              Editar nombre / WhatsApp
            </button>
          </div>
        )}

        {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}

        <Fila etiqueta="Correo" valor={huesped.correo} />
        <Fila etiqueta="Habitación" valor={huesped.numero_habitacion} />
        <Fila etiqueta="Estado de la cuenta" valor={huesped.activo ? 'Activa' : 'Inactiva'} />
      </dl>

      {acuerdoActivo ? (
        <>
          <h2 className="mt-6 text-lg font-semibold text-marca-900">Acuerdo actual</h2>
          <dl className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            <Fila etiqueta="Fecha de ingreso" valor={acuerdoActivo.fecha_ingreso} />
            <Fila etiqueta="Meses del acuerdo" valor={String(acuerdoActivo.meses_acuerdo)} />
            <Fila
              etiqueta="Día de pago mensual"
              valor={`Día ${diaDePago(acuerdoActivo.fecha_ingreso)} de cada mes`}
            />
            <Fila
              etiqueta="Meses transcurridos"
              valor={`${mesesTranscurridos(acuerdoActivo.fecha_ingreso)} de ${acuerdoActivo.meses_acuerdo}`}
            />
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            La habitación, la fecha de ingreso y el número de meses no se pueden editar desde la
            app. Si necesitas actualizar alguno de estos datos, contacta al administrador
            indicando qué dato deseas cambiar y el motivo del cambio.
          </p>
          <Link to="/pagos" className="mt-4 inline-block text-marca-700 underline">
            Ver mis pagos
          </Link>
        </>
      ) : (
        <p className="mt-6 text-slate-600">
          No tienes un acuerdo activo. Contacta al administrador para renovar.
        </p>
      )}
    </section>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="font-medium text-slate-900">{valor}</dd>
    </div>
  )
}
