import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import ActivarPush from './ActivarPush'
import MenuHamburguesa, { type ItemHamburguesa } from './MenuHamburguesa'
import { useAuth } from '../context/AuthContext'
import { opcionesMenu } from '../lib/menu'
import { getSupabase } from '../lib/supabase'
import { configuracionLista } from '../lib/supabase'

export default function Layout() {
  const { sesion, huesped, esAdmin, cerrarSesion } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [noLeidas, setNoLeidas] = useState(0)
  const [menuAbierto, setMenuAbierto] = useState(false)

  useEffect(() => {
    setMenuAbierto(false)
  }, [ubicacion.pathname])

  useEffect(() => {
    if (!huesped) {
      setNoLeidas(0)
      return
    }
    getSupabase()
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('huesped_id', huesped.id)
      .eq('canal', 'app')
      .eq('leido', false)
      .then(({ count }) => setNoLeidas(count ?? 0))
  }, [huesped, ubicacion.pathname])

  async function salir() {
    setMenuAbierto(false)
    await cerrarSesion()
    navegar('/')
  }

  const items: ItemHamburguesa[] = sesion
    ? [
        { to: '/menu', etiqueta: 'Menú principal' },
        ...opcionesMenu({ esAdmin, tieneHuesped: Boolean(huesped) }).map((opcion) => ({
          to: opcion.to,
          etiqueta: opcion.titulo,
          contador: opcion.id === 'notificaciones' ? noLeidas : undefined,
        })),
      ]
    : [
        { to: '/ingresar', etiqueta: 'Iniciar sesión' },
        { to: '/registro', etiqueta: 'Crear cuenta' },
      ]

  // El menú principal (tarjetas) usa más ancho que el resto de las pantallas.
  const ancho = ubicacion.pathname === '/menu' ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <div className="flex min-h-dvh flex-col">
      <ActivarPush />
      <header className="bg-marca-700 text-white shadow">
        <div className={`mx-auto flex ${ancho} items-center gap-3 px-4 py-3`}>
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <Link to={sesion ? '/menu' : '/'} className="text-lg font-semibold">
            Sol Estudio Hab
          </Link>

          <MenuHamburguesa
            abierto={menuAbierto}
            onAlternar={() => setMenuAbierto((abierto) => !abierto)}
            onCerrar={() => setMenuAbierto(false)}
            items={items}
            accion={sesion ? { etiqueta: 'Cerrar sesión', onClick: salir } : undefined}
            aviso={noLeidas > 0}
          />
        </div>
      </header>

      {!configuracionLista && (
        <div className="bg-sol-400 px-4 py-2 text-center text-sm font-medium text-slate-900">
          Falta configurar la conexión al servidor (archivo .env). Ver README.
        </div>
      )}

      <main className={`mx-auto w-full ${ancho} flex-1 px-4 py-6`}>
        <Outlet />
      </main>

      <footer className="px-4 py-4 text-center text-xs text-slate-500">
        Sol Estudio Hab — gestión de pagos de arriendo
      </footer>
    </div>
  )
}
