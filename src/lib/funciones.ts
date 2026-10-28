import { getSupabase } from './supabase'

/**
 * Invoca una Edge Function y devuelve el JSON o un mensaje de error legible. Las
 * funciones de este proyecto responden `{ error: "..." }` con un código HTTP de error.
 */
export async function invocarFuncion<T>(
  nombre: string,
  cuerpo: Record<string, unknown>,
): Promise<{ datos: T | null; error: string | null }> {
  const { data, error } = await getSupabase().functions.invoke(nombre, { body: cuerpo })
  if (!error) return { datos: data as T, error: null }

  const respuesta = (error as { context?: Response }).context
  if (respuesta && typeof respuesta.json === 'function') {
    try {
      const cuerpoError = (await respuesta.json()) as { error?: string }
      if (cuerpoError.error) return { datos: null, error: cuerpoError.error }
    } catch {
      // se usa el mensaje genérico
    }
  }
  return { datos: null, error: 'No se pudo completar la solicitud. Revisa tu conexión e intenta de nuevo.' }
}
