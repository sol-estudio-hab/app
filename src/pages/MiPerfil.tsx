import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { diaDePago, mesesTranscurridos } from '../lib/fechas'

export default function MiPerfil() {
  const { huesped, acuerdoActivo } = useAuth()

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

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-marca-900">Mi perfil</h1>

      <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        <Fila etiqueta="Nombres" valor={huesped.nombres} />
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
