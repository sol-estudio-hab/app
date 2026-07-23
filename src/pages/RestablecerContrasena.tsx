import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Campo from '../components/Campo'
import { useAuth } from '../context/AuthContext'

export default function RestablecerContrasena() {
  const { sesion, cargando, actualizarContrasena } = useAuth()
  const navegar = useNavigate()

  const [contrasena, setContrasena] = useState('')
  const [confirmarContrasena, setConfirmarContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    if (contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (contrasena !== confirmarContrasena) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setEnviando(true)
    const { error: errorActualizar } = await actualizarContrasena(contrasena)
    setEnviando(false)
    if (errorActualizar) {
      setError(errorActualizar)
      return
    }
    setListo(true)
    setTimeout(() => navegar('/perfil'), 1500)
  }

  if (cargando) return <p className="mt-8 text-center text-slate-500">Cargando…</p>

  if (!sesion) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Enlace inválido o vencido</h1>
        <p className="mt-3 text-slate-600">
          Solicita un nuevo enlace para restablecer tu contraseña.
        </p>
        <Link to="/recuperar-contrasena" className="mt-4 inline-block text-marca-700 underline">
          Solicitar enlace
        </Link>
      </section>
    )
  }

  if (listo) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Contraseña actualizada</h1>
        <p className="mt-3 text-slate-600">Te estamos redirigiendo…</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Restablecer contraseña</h1>

      <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
        <Campo
          etiqueta="Nueva contraseña"
          tipo="password"
          valor={contrasena}
          onCambio={setContrasena}
          autoComplete="new-password"
        />
        <Campo
          etiqueta="Confirmar nueva contraseña"
          tipo="password"
          valor={confirmarContrasena}
          onCambio={setConfirmarContrasena}
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
        >
          {enviando ? 'Guardando…' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </section>
  )
}
