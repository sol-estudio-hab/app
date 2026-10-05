import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Campo from '../components/Campo'
import { HABITACIONES } from '../lib/habitaciones'
import { getSupabase } from '../lib/supabase'

interface Creado {
  id: string
  nombres: string
  correo: string
  invitacionEnviada: boolean
  pidioInvitacion: boolean
}

async function mensajeDeError(error: unknown): Promise<string> {
  const respuesta = (error as { context?: Response }).context
  if (respuesta && typeof respuesta.json === 'function') {
    try {
      const cuerpo = (await respuesta.json()) as { error?: string }
      if (cuerpo.error) return cuerpo.error
    } catch {
      // se usa el mensaje genérico
    }
  }
  return 'No se pudo crear el huésped. Intenta de nuevo.'
}

export default function NuevoHuespedAdmin() {
  const [correo, setCorreo] = useState('')
  const [nombres, setNombres] = useState('')
  const [numeroHabitacion, setNumeroHabitacion] = useState('')
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [mesesAcuerdo, setMesesAcuerdo] = useState('')
  const [numeroWhatsapp, setNumeroWhatsapp] = useState('')
  const [enviarInvitacion, setEnviarInvitacion] = useState(false)

  const [habitacionesDisponibles, setHabitacionesDisponibles] = useState<string[]>([])
  const [cargandoHabitaciones, setCargandoHabitaciones] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<Creado | null>(null)

  async function cargarHabitaciones() {
    const { data, error: errorRpc } = await getSupabase().rpc('habitaciones_ocupadas')
    const ocupadas = new Set(errorRpc ? [] : ((data as string[] | null) ?? []))
    setHabitacionesDisponibles(HABITACIONES.filter((h) => !ocupadas.has(h)))
    setCargandoHabitaciones(false)
  }

  useEffect(() => {
    cargarHabitaciones()
  }, [])

  async function crear(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    const meses = Number(mesesAcuerdo)
    if (!numeroHabitacion) {
      setError('Selecciona una habitación.')
      return
    }
    if (!Number.isInteger(meses) || meses <= 0) {
      setError('El número de meses del acuerdo debe ser un entero mayor a 0.')
      return
    }

    setEnviando(true)
    const { data, error: errorInvocar } = await getSupabase().functions.invoke('crear-huesped-admin', {
      body: {
        correo,
        nombres,
        numeroHabitacion,
        fechaIngreso,
        mesesAcuerdo: meses,
        numeroWhatsapp: numeroWhatsapp.trim(),
        enviarInvitacion,
      },
    })
    setEnviando(false)

    if (errorInvocar || !data?.id) {
      setError(errorInvocar ? await mensajeDeError(errorInvocar) : 'No se pudo crear el huésped.')
      return
    }

    setCreado({
      id: data.id as string,
      nombres,
      correo,
      invitacionEnviada: Boolean(data.invitacionEnviada),
      pidioInvitacion: enviarInvitacion,
    })
  }

  function crearOtro() {
    setCreado(null)
    setCorreo('')
    setNombres('')
    setNumeroHabitacion('')
    setFechaIngreso('')
    setMesesAcuerdo('')
    setNumeroWhatsapp('')
    setEnviarInvitacion(false)
    setCargandoHabitaciones(true)
    cargarHabitaciones()
  }

  if (creado) {
    return (
      <section className="mx-auto max-w-md">
        <h1 className="text-xl font-bold text-marca-900">Huésped creado</h1>
        <p className="mt-3 text-slate-600">
          <strong>{creado.nombres}</strong> ({creado.correo}) ya quedó registrado y empezará a
          recibir los recordatorios, avisos y alertas por correo (y por WhatsApp si tiene número).
          Las notificaciones push solo llegan cuando el huésped inicia sesión y las activa en su
          dispositivo.
        </p>
        {creado.pidioInvitacion && (
          <p
            className={`mt-3 text-sm ${creado.invitacionEnviada ? 'text-green-700' : 'text-red-600'}`}
          >
            {creado.invitacionEnviada
              ? 'Le enviamos un correo para que establezca su contraseña.'
              : 'No se pudo enviar el correo de invitación. Puede usar "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.'}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/admin/huespedes/${creado.id}`}
            className="rounded-lg bg-marca-700 px-4 py-2 font-semibold text-white hover:bg-marca-800"
          >
            Ver detalle
          </Link>
          <button
            type="button"
            onClick={crearOtro}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Crear otro huésped
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Nuevo huésped</h1>
      <p className="mt-1 text-sm text-slate-600">
        Crea la cuenta de un huésped que no se registró por su cuenta, para que igual le lleguen los
        recordatorios, avisos y alertas.
      </p>

      <form onSubmit={crear} className="mt-6 flex flex-col gap-4">
        <Campo
          etiqueta="Correo electrónico"
          tipo="email"
          valor={correo}
          onCambio={setCorreo}
          autoComplete="off"
        />
        <Campo etiqueta="Nombres" tipo="text" valor={nombres} onCambio={setNombres} />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Número de habitación
          <select
            required
            value={numeroHabitacion}
            onChange={(e) => setNumeroHabitacion(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900 focus:border-marca-600 focus:outline-none focus:ring-1 focus:ring-marca-600"
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
            <span className="text-xs text-red-600">No hay habitaciones libres en este momento.</span>
          )}
        </label>
        <Campo
          etiqueta="Fecha de ingreso (igual a la del acuerdo firmado)"
          tipo="date"
          valor={fechaIngreso}
          onCambio={setFechaIngreso}
        />
        <Campo
          etiqueta="Número de meses del acuerdo"
          tipo="number"
          valor={mesesAcuerdo}
          onCambio={setMesesAcuerdo}
          min={1}
        />
        <Campo
          etiqueta="Número de WhatsApp"
          tipo="tel"
          valor={numeroWhatsapp}
          onCambio={setNumeroWhatsapp}
          opcional
        />

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={enviarInvitacion}
            onChange={(e) => setEnviarInvitacion(e.target.checked)}
            className="mt-1"
          />
          <span>
            Enviarle un correo para que establezca su contraseña y pueda entrar a la app (si no lo
            marcas, solo recibirá los avisos; después podrá entrar con &quot;¿Olvidaste tu
            contraseña?&quot;).
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
        >
          {enviando ? 'Creando huésped…' : 'Crear huésped'}
        </button>
      </form>
    </section>
  )
}
