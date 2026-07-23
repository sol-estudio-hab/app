import { Link } from 'react-router-dom'

export default function NoEncontrado() {
  return (
    <section className="mx-auto max-w-md text-center">
      <h1 className="mt-8 text-xl font-bold text-marca-900">
        Página no encontrada
      </h1>
      <Link to="/" className="mt-4 inline-block text-marca-700 underline">
        Volver al inicio
      </Link>
    </section>
  )
}
