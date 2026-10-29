import MenuOpciones from '../components/MenuOpciones'
import { useAuth } from '../context/AuthContext'
import { opcionesMenu } from '../lib/menu'

export default function MenuPrincipal() {
  const { huesped, esAdmin } = useAuth()
  const opciones = opcionesMenu({ esAdmin, tieneHuesped: Boolean(huesped) })

  return (
    <section>
      <h1 className="text-2xl font-bold text-marca-900">
        Hola{huesped ? `, ${huesped.nombres}` : esAdmin ? ', administrador' : ''}
      </h1>
      <p className="mb-6 mt-1 text-slate-600">¿Qué quieres hacer hoy?</p>
      <MenuOpciones opciones={opciones} />
    </section>
  )
}
