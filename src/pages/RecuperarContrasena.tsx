import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import Campo from '../components/Campo'
import { useAuth } from '../context/AuthContext'

export default function RecuperarContrasena() {
  const { recuperarContrasena } = useAuth()

  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    const { error: errorEnvio } = await recuperarContrasena(correo)
    setEnviando(false)
    if (errorEnvio) {
      setError(errorEnvio)
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold text-marca-900">Revisa tu correo</h1>
        <p className="mt-3 text-slate-600">
          Si el correo <strong>{correo}</strong> está registrado, recibirás un enlace
          para restablecer tu contraseña.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Recuperar contraseña</h1>
      <p className="mt-2 text-sm text-slate-600">
        Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
        <Campo
          etiqueta="Correo electrónico"
          tipo="email"
          valor={correo}
          onCambio={setCorreo}
          autoComplete="email"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800 disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link to="/ingresar" className="text-marca-700 underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </section>
  )
}
