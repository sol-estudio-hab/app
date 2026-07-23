import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true cuando el archivo .env tiene las credenciales del proyecto Supabase */
export const configuracionLista = Boolean(supabaseUrl && supabaseAnonKey)

let cliente: SupabaseClient | null = null

/** Cliente único de Supabase. Lanza error si falta la configuración (.env). */
export function getSupabase(): SupabaseClient {
  if (!configuracionLista) {
    throw new Error(
      'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env',
    )
  }
  cliente ??= createClient(supabaseUrl, supabaseAnonKey)
  return cliente
}
