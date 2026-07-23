import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Campo from '../components/Campo'
import { useAuth } from '../context/AuthContext'

export default function Ingresar() {
  const { iniciarSesion } = useAuth()
  const navegar = useNavigate()

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    const { error: errorLogin } = await iniciarSesion(correo, contrasena)
    setEnviando(false)
    if (errorLogin) {
      setError(errorLogin)
      return
    }
    navegar('/')
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Iniciar sesión</h1>

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
          autoComplete="current-password"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2 text-sm">
        <Link to="/recuperar-contrasena" className="text-marca-700 underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <p className="text-slate-600">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="text-marca-700 underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </section>
  )
}
