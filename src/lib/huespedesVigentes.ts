import { getSupabase } from './supabase'

export interface HuespedVigente {
  id: string
  nombres: string
  correo: string
  numero_habitacion: string
  numero_whatsapp: string | null
}

/** Huéspedes con estadía vigente (acuerdo activo) y sin archivar, ordenados por habitación. */
export async function cargarHuespedesVigentes(): Promise<HuespedVigente[]> {
  const { data } = await getSupabase()
    .from('acuerdos')
    .select('huespedes!inner(id, nombres, correo, numero_habitacion, numero_whatsapp, archivado)')
    .eq('estado', 'activo')
    .eq('huespedes.archivado', false)
  const lista = ((data ?? []) as unknown as { huespedes: HuespedVigente }[]).map((f) => f.huespedes)
  return lista.sort((a, b) => a.numero_habitacion.localeCompare(b.numero_habitacion))
}
