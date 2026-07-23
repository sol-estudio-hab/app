import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RutaAdmin() {
  const { cargando, sesion, esAdmin } = useAuth()

  if (cargando) return <p className="mt-8 text-center text-slate-500">Cargando…</p>
  if (!sesion) return <Navigate to="/ingresar" replace />
  if (!esAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
