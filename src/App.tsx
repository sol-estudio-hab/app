import { Route, Routes } from 'react-router-dom'
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
import PanelAdmin from './pages/PanelAdmin'
import RecuperarContrasena from './pages/RecuperarContrasena'
import Reportes from './pages/Reportes'
import Registro from './pages/Registro'
import RestablecerContrasena from './pages/RestablecerContrasena'

export default function App() {
  return (
    <Routes>
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
          <Route path="admin/huespedes/:id" element={<DetalleHuespedAdmin />} />
          <Route path="admin/reportes" element={<Reportes />} />
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  )
}
