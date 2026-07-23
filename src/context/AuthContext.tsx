import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { configuracionLista, getSupabase } from '../lib/supabase'
import type { Acuerdo, Huesped } from '../types/dominio'

interface DatosRegistro {
  nombres: string
  numeroHabitacion: string
  fechaIngreso: string
  mesesAcuerdo: number
}

interface EstadoAuth {
  cargando: boolean
  sesion: Session | null
  huesped: Huesped | null
  acuerdoActivo: Acuerdo | null
  esAdmin: boolean
  registrarse: (
    correo: string,
    contrasena: string,
    datos: DatosRegistro,
  ) => Promise<{ error: string | null }>
  iniciarSesion: (correo: string, contrasena: string) => Promise<{ error: string | null }>
  cerrarSesion: () => Promise<void>
  recuperarContrasena: (correo: string) => Promise<{ error: string | null }>
  actualizarContrasena: (nuevaContrasena: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<EstadoAuth | null>(null)

const MENSAJES_ERROR: Record<string, string> = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con este correo.',
  'email rate limit exceeded':
    'Se alcanzó el límite de correos del servidor. Intenta de nuevo en unos minutos.',
}

function traducirError(mensaje: string): string {
  if (MENSAJES_ERROR[mensaje]) return MENSAJES_ERROR[mensaje]
  if (/email address .* is invalid/i.test(mensaje)) return 'El correo electrónico no es válido.'
  if (/password/i.test(mensaje) && /least/i.test(mensaje)) {
    return 'La contraseña no cumple con los requisitos mínimos.'
  }
  return mensaje
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [huesped, setHuesped] = useState<Huesped | null>(null)
  const [acuerdoActivo, setAcuerdoActivo] = useState<Acuerdo | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)

  async function cargarPerfil(userId: string) {
    const supabase = getSupabase()
    const [huespedRes, acuerdoRes, adminRes] = await Promise.all([
      supabase.from('huespedes').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('acuerdos')
        .select('*')
        .eq('huesped_id', userId)
        .eq('estado', 'activo')
        .maybeSingle(),
      supabase.rpc('es_admin'),
    ])
    setHuesped((huespedRes.data as Huesped | null) ?? null)
    setAcuerdoActivo((acuerdoRes.data as Acuerdo | null) ?? null)
    setEsAdmin(Boolean(adminRes.data))
  }

  function limpiarPerfil() {
    setHuesped(null)
    setAcuerdoActivo(null)
    setEsAdmin(false)
  }

  useEffect(() => {
    if (!configuracionLista) {
      setCargando(false)
      return
    }
    const supabase = getSupabase()

    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session)
      if (data.session?.user) await cargarPerfil(data.session.user.id)
      setCargando(false)
    })

    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      async (_evento, nuevaSesion) => {
        setSesion(nuevaSesion)
        if (nuevaSesion?.user) {
          await cargarPerfil(nuevaSesion.user.id)
        } else {
          limpiarPerfil()
        }
      },
    )

    return () => suscripcion.subscription.unsubscribe()
  }, [])

  async function registrarse(
    correo: string,
    contrasena: string,
    datos: DatosRegistro,
  ) {
    const supabase = getSupabase()
    const { error } = await supabase.auth.signUp({
      email: correo,
      password: contrasena,
      options: {
        emailRedirectTo: `${window.location.origin}/ingresar`,
        data: {
          nombres: datos.nombres,
          numero_habitacion: datos.numeroHabitacion,
          fecha_ingreso: datos.fechaIngreso,
          meses_acuerdo: datos.mesesAcuerdo,
        },
      },
    })
    return { error: error ? traducirError(error.message) : null }
  }

  async function iniciarSesion(correo: string, contrasena: string) {
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    })
    return { error: error ? traducirError(error.message) : null }
  }

  async function cerrarSesion() {
    await getSupabase().auth.signOut()
  }

  async function recuperarContrasena(correo: string) {
    const supabase = getSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    })
    return { error: error ? traducirError(error.message) : null }
  }

  async function actualizarContrasena(nuevaContrasena: string) {
    const supabase = getSupabase()
    const { error } = await supabase.auth.updateUser({ password: nuevaContrasena })
    return { error: error ? traducirError(error.message) : null }
  }

  const valor: EstadoAuth = {
    cargando,
    sesion,
    huesped,
    acuerdoActivo,
    esAdmin,
    registrarse,
    iniciarSesion,
    cerrarSesion,
    recuperarContrasena,
    actualizarContrasena,
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth(): EstadoAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
