import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import RutaAdmin from './components/RutaAdmin'
import RutaPrivada from './components/RutaPrivada'
import DetalleHuespedAdmin from './pages/DetalleHuespedAdmin'
import Inicio from './pages/Inicio'
import Ingresar from './pages/Ingresar'
import MiPerfil from './pages/MiPerfil'
import MisPagos from './pages/MisPagos'
import NoEncontrado from './pages/NoEncontrado'
import Notificaciones from './pages/Notificaciones'
import NuevoHuespedAdmin from './pages/NuevoHuespedAdmin'
import PanelAdmin from './pages/PanelAdmin'
import RecuperarContrasena from './pages/RecuperarContrasena'
import Reportes from './pages/Reportes'
import Registro from './pages/Registro'
import RestablecerContrasena from './pages/RestablecerContrasena'

// La firma de PDFs trae librerías pesadas (pdf.js): se cargan solo al entrar a estas pantallas.
const Firmar = lazy(() => import('./pages/Firmar'))
const FirmasAdmin = lazy(() => import('./pages/FirmasAdmin'))
const NuevaFirmaAdmin = lazy(() => import('./pages/NuevaFirmaAdmin'))

const cargandoPantalla = <p className="mt-16 text-center text-slate-500">Cargando…</p>

export default function App() {
  const { pathname } = useLocation()

  // En el dominio firmas.solestudiohab.com el enlace es /?t=<token>: va directo a la firma.
  if (window.location.hostname.startsWith('firmas.') && pathname === '/') {
    return <Suspense fallback={cargandoPantalla}>{<Firmar />}</Suspense>
  }

  return (
    <Suspense fallback={cargandoPantalla}>
      <Routes>
        <Route path="firmar" element={<Firmar />} />
        <Route element={<Layout />}>
          <Route index element={<Inicio />} />
          <Route path="ingresar" element={<Ingresar />} />
          <Route path="registro" element={<Registro />} />
          <Route path="recuperar-contrasena" element={<RecuperarContrasena />} />
          <Route path="restablecer-contrasena" element={<RestablecerContrasena />} />
          <Route element={<RutaPrivada />}>
            <Route path="perfil" element={<MiPerfil />} />
            <Route path="pagos" element={<MisPagos />} />
            <Route path="notificaciones" element={<Notificaciones />} />
          </Route>
          <Route element={<RutaAdmin />}>
            <Route path="admin" element={<PanelAdmin />} />
            <Route path="admin/huespedes/nuevo" element={<NuevoHuespedAdmin />} />
            <Route path="admin/huespedes/:id" element={<DetalleHuespedAdmin />} />
            <Route path="admin/reportes" element={<Reportes />} />
            <Route path="admin/firmas" element={<FirmasAdmin />} />
            <Route path="admin/firmas/nueva" element={<NuevaFirmaAdmin />} />
          </Route>
          <Route path="*" element={<NoEncontrado />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
