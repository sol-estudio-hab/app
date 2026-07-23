import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Inicio() {
  const { sesion, huesped } = useAuth()

  if (sesion) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="mt-8 text-2xl font-bold text-marca-900">
          Hola{huesped ? `, ${huesped.nombres}` : ''}
        </h1>
        <p className="mt-3 text-slate-600">
          Consulta el estado de tus pagos y sube tu comprobante cada mes.
        </p>
        <Link
          to="/pagos"
          className="mt-8 inline-block rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800"
        >
          Ir a mis pagos
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md text-center">
      <h1 className="mt-8 text-2xl font-bold text-marca-900">
        Bienvenido a Sol Estudio Hab
      </h1>
      <p className="mt-3 text-slate-600">
        Registra tus pagos de arriendo, sube tu comprobante cada mes y recibe
        recordatorios de tu fecha de pago.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/ingresar"
          className="rounded-lg bg-marca-700 px-4 py-3 font-semibold text-white shadow hover:bg-marca-800"
        >
          Iniciar sesión
        </Link>
        <Link
          to="/registro"
          className="rounded-lg border border-marca-700 px-4 py-3 font-semibold text-marca-700 hover:bg-marca-100"
        >
          Crear cuenta
        </Link>
      </div>
    </section>
  )
}
