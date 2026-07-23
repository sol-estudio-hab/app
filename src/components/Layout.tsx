import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import ActivarPush from './ActivarPush'
import { useAuth } from '../context/AuthContext'
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

  const enlaces = sesion ? (
    <>
      {esAdmin && (
        <>
          <Link to="/admin" className="hover:underline">
            Panel admin
          </Link>
          <Link to="/admin/reportes" className="hover:underline">
            Reportes
          </Link>
        </>
      )}
      <Link to="/pagos" className="hover:underline">
        Mis pagos
      </Link>
      {huesped && (
        <Link to="/notificaciones" className="relative hover:underline">
          Notificaciones
          {noLeidas > 0 && (
            <span className="ml-1 rounded-full bg-sol-500 px-1.5 py-0.5 text-xs font-semibold text-slate-900">
              {noLeidas}
            </span>
          )}
        </Link>
      )}
      <Link to="/perfil" className="hover:underline">
        Mi perfil
      </Link>
      <button type="button" onClick={salir} className="text-left hover:underline">
        Cerrar sesión
      </button>
    </>
  ) : (
    <>
      <Link to="/ingresar" className="hover:underline">
        Iniciar sesión
      </Link>
      <Link to="/registro" className="hover:underline">
        Crear cuenta
      </Link>
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <ActivarPush />
      <header className="bg-marca-700 text-white shadow">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <Link to="/" className="text-lg font-semibold">
            Sol Estudio Hab
          </Link>

          <nav className="ml-auto hidden items-center gap-4 text-sm sm:flex">{enlaces}</nav>

          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            className="ml-auto flex h-9 w-9 flex-col items-center justify-center gap-1.5 sm:hidden"
          >
            <span
              className={`h-0.5 w-6 rounded-full bg-white transition-transform ${menuAbierto ? 'translate-y-2 rotate-45' : ''}`}
            />
            <span
              className={`h-0.5 w-6 rounded-full bg-white transition-opacity ${menuAbierto ? 'opacity-0' : ''}`}
            />
            <span
              className={`h-0.5 w-6 rounded-full bg-white transition-transform ${menuAbierto ? '-translate-y-2 -rotate-45' : ''}`}
            />
          </button>
        </div>

        {menuAbierto && (
          <nav className="flex flex-col gap-3 border-t border-white/20 px-4 py-4 text-sm sm:hidden">
            {enlaces}
          </nav>
        )}
      </header>

      {!configuracionLista && (
        <div className="bg-sol-400 px-4 py-2 text-center text-sm font-medium text-slate-900">
          Falta configurar la conexión al servidor (archivo .env). Ver README.
        </div>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="px-4 py-4 text-center text-xs text-slate-500">
        Sol Estudio Hab — gestión de pagos de arriendo
      </footer>
    </div>
  )
}
