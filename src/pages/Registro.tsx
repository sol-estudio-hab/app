import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import Campo from '../components/Campo'
import { useAuth } from '../context/AuthContext'

export default function Registro() {
  const { registrarse } = useAuth()

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmarContrasena, setConfirmarContrasena] = useState('')
  const [nombres, setNombres] = useState('')
  const [numeroHabitacion, setNumeroHabitacion] = useState('')
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [mesesAcuerdo, setMesesAcuerdo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  function validar(): string | null {
    if (
      !correo ||
      !contrasena ||
      !nombres ||
      !numeroHabitacion ||
      !fechaIngreso ||
      !mesesAcuerdo
    ) {
      return 'Todos los campos son obligatorios.'
    }
    if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
    if (contrasena !== confirmarContrasena) return 'Las contraseñas no coinciden.'
    const meses = Number(mesesAcuerdo)
    if (!Number.isInteger(meses) || meses <= 0) {
      return 'El número de meses del acuerdo debe ser un entero mayor a 0.'
    }
    return null
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    const mensajeValidacion = validar()
    if (mensajeValidacion) {
      setError(mensajeValidacion)
      return
    }
    setEnviando(true)
    const { error: errorRegistro } = await registrarse(correo, contrasena, {
      nombres,
      numeroHabitacion,
      fechaIngreso,
      mesesAcuerdo: Number(mesesAcuerdo),
    })
    setEnviando(false)
    if (errorRegistro) {
      setError(errorRegistro)
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Revisa tu correo</h1>
        <p className="mt-3 text-slate-600">
          Te enviamos un correo a <strong>{correo}</strong> para confirmar tu cuenta.
          Una vez confirmada, podrás iniciar sesión.
        </p>
        <Link to="/ingresar" className="mt-6 inline-block text-marca-700 underline">
          Ir a iniciar sesión
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Crear cuenta</h1>
      <p className="mt-1 text-sm text-slate-600">
        Completa tus datos según el acuerdo de arriendo firmado.
      </p>

      <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
        <Campo
          etiqueta="Correo electrónico"
          tipo="email"
          valor={correo}
          onCambio={setCorreo}
          autoComplete="email"
        />
        <Campo
          etiqueta="Contraseña"
          tipo="password"
          valor={contrasena}
          onCambio={setContrasena}
          autoComplete="new-password"
        />
        <Campo
          etiqueta="Confirmar contraseña"
          tipo="password"
          valor={confirmarContrasena}
          onCambio={setConfirmarContrasena}
          autoComplete="new-password"
        />
        <Campo etiqueta="Nombres" tipo="text" valor={nombres} onCambio={setNombres} />
        <Campo
          etiqueta="Número de habitación"
          tipo="text"
          valor={numeroHabitacion}
          onCambio={setNumeroHabitacion}
        />
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
        >
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{' '}
        <Link to="/ingresar" className="text-marca-700 underline">
          Inicia sesión
        </Link>
      </p>
    </section>
  )
}
