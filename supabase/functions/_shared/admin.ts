// Comprobación de administrador para Edge Functions que se llaman con la sesión del
// admin (verificación de JWT activa). Devuelve el id del admin o una Response de error.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { errorJson } from './firmas.ts'

export async function exigirAdmin(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ userId: string } | Response> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return errorJson('No autorizado', 401)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return errorJson('No autorizado', 401)
  const { data: admin } = await supabase.from('admins').select('id').eq('id', data.user.id).maybeSingle()
  if (!admin) return errorJson('Solo un administrador puede hacer esto.', 403)
  return { userId: data.user.id }
}
