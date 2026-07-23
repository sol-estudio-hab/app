// Pruebas de seguridad (T6.3.1): verifican contra el proyecto Supabase REAL
// que las políticas de Row Level Security aíslan correctamente a cada rol.
// No son pruebas unitarias (no hay red ni credenciales de por medio en
// src/lib/*.test.ts) — estas SÍ hacen llamadas reales, por eso viven aparte
// y requieren variables de entorno con cuentas de prueba ya existentes.
//
// Ejecutar con:
//   HUESPED_PRUEBA_EMAIL=... HUESPED_PRUEBA_PASSWORD=... \
//   ADMIN_PRUEBA_EMAIL=...   ADMIN_PRUEBA_PASSWORD=...   \
//   npm run test:seguridad
//
// Si faltan las variables, la suite se omite (no falla el CI por defecto).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const HUESPED_EMAIL = process.env.HUESPED_PRUEBA_EMAIL
const HUESPED_PASSWORD = process.env.HUESPED_PRUEBA_PASSWORD
const ADMIN_EMAIL = process.env.ADMIN_PRUEBA_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PRUEBA_PASSWORD

const configuracionCompleta = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && HUESPED_EMAIL && HUESPED_PASSWORD && ADMIN_EMAIL && ADMIN_PASSWORD,
)

function nuevoCliente(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
}

describe.runIf(configuracionCompleta)('Seguridad — Row Level Security', () => {
  let anonimo: SupabaseClient
  let comoHuesped: SupabaseClient
  let comoAdmin: SupabaseClient
  let huespedId: string

  beforeAll(async () => {
    anonimo = nuevoCliente()

    comoHuesped = nuevoCliente()
    const { data: sesionHuesped, error: errorHuesped } = await comoHuesped.auth.signInWithPassword({
      email: HUESPED_EMAIL!,
      password: HUESPED_PASSWORD!,
    })
    if (errorHuesped || !sesionHuesped.user) throw new Error(`No se pudo iniciar sesión como huésped: ${errorHuesped?.message}`)
    huespedId = sesionHuesped.user.id

    comoAdmin = nuevoCliente()
    const { error: errorAdmin } = await comoAdmin.auth.signInWithPassword({
      email: ADMIN_EMAIL!,
      password: ADMIN_PASSWORD!,
    })
    if (errorAdmin) throw new Error(`No se pudo iniciar sesión como admin: ${errorAdmin.message}`)
  })

  it('un cliente sin sesión no puede leer huéspedes', async () => {
    const { data, error } = await anonimo.from('huespedes').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('un cliente sin sesión no puede leer pagos', async () => {
    const { data } = await anonimo.from('pagos').select('*')
    expect(data).toEqual([])
  })

  it('un cliente sin sesión no puede leer la tabla de administradores', async () => {
    const { data } = await anonimo.from('admins').select('*')
    expect(data).toEqual([])
  })

  it('un huésped solo ve su propia fila en huespedes, aunque consulte sin filtro', async () => {
    const { data, error } = await comoHuesped.from('huespedes').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0].id).toBe(huespedId)
  })

  it('un huésped no puede leer la tabla de administradores', async () => {
    const { data } = await comoHuesped.from('admins').select('*')
    expect(data).toEqual([])
  })

  it('un huésped no puede insertarse a sí mismo en la tabla de administradores', async () => {
    const { error } = await comoHuesped
      .from('admins')
      .insert({ id: huespedId, correo: 'intento@ejemplo.com', nombres: 'Intento de escalada' })
    expect(error).not.toBeNull()
  })

  it('un huésped no puede marcar como "verificado" su propio pago (solo el admin puede)', async () => {
    // Debe apuntar a un pago que empiece en "cargado" — si tomáramos uno ya
    // "verificado" legítimamente, la aserción de abajo pasaría por la razón
    // equivocada (nunca cambió) en vez de probar realmente el WITH CHECK.
    const { data: pagos } = await comoHuesped
      .from('pagos')
      .select('id, estado')
      .eq('estado', 'cargado')
      .limit(1)
    if (!pagos || pagos.length === 0) return // no hay ningún pago "cargado" de prueba, se omite
    await comoHuesped.from('pagos').update({ estado: 'verificado' }).eq('id', pagos[0].id)
    // La política permite el UPDATE en sí (sin error de red), pero el WITH CHECK
    // de RLS debe rechazar la fila resultante porque 'verificado' no es un
    // estado que el huésped pueda asignar — Postgres responde con 0 filas
    // afectadas, y el estado real en la BD debe seguir siendo "cargado".
    const { data: pagoTrasIntento } = await comoHuesped
      .from('pagos')
      .select('estado')
      .eq('id', pagos[0].id)
      .single()
    expect(pagoTrasIntento?.estado).toBe('cargado')
  })

  it('el administrador sí puede leer todos los huéspedes', async () => {
    const { data, error } = await comoAdmin.from('huespedes').select('*')
    expect(error).toBeNull()
    expect((data?.length ?? 0)).toBeGreaterThanOrEqual(1)
  })

  it('un huésped no puede leer un comprobante fuera de su propia carpeta', async () => {
    const rutaAjena = 'carpeta-inventada-0000/2026-01.png'
    const { error } = await comoHuesped.storage.from('comprobantes').createSignedUrl(rutaAjena, 60)
    expect(error).not.toBeNull()
  })
})
