// Sol Estudio Hab — Edge Function: respaldo-comprobantes
//
// Job periódico (ver README para la programación con pg_cron, sugerido
// semanal). Copia los comprobantes del bucket `comprobantes` al bucket
// separado `comprobantes-respaldo`, sin volver a copiar los que ya
// estaban respaldados (incremental).
//
// Requiere el secret CRON_SECRET (el mismo usado por las demás
// funciones de cron).

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: carpetas, error: errorCarpetas } = await supabase.storage
    .from('comprobantes')
    .list('', { limit: 1000 })

  if (errorCarpetas) {
    console.error(errorCarpetas)
    return new Response(JSON.stringify({ error: errorCarpetas.message }), { status: 500 })
  }

  let copiados = 0
  let yaExistian = 0
  let errores = 0

  for (const carpeta of carpetas ?? []) {
    // Las carpetas de huésped se listan sin id; una entrada con id es un
    // archivo suelto en la raíz (no debería ocurrir con nuestra
    // estructura {huesped_id}/{mes}.ext, pero se ignora por seguridad).
    if (carpeta.id) continue

    const [{ data: archivosOrigen }, { data: archivosRespaldo }] = await Promise.all([
      supabase.storage.from('comprobantes').list(carpeta.name, { limit: 1000 }),
      supabase.storage.from('comprobantes-respaldo').list(carpeta.name, { limit: 1000 }),
    ])
    const yaRespaldados = new Set((archivosRespaldo ?? []).map((a) => a.name))

    for (const archivo of archivosOrigen ?? []) {
      if (yaRespaldados.has(archivo.name)) {
        yaExistian++
        continue
      }
      const ruta = `${carpeta.name}/${archivo.name}`
      const { error: errorCopia } = await supabase.storage
        .from('comprobantes')
        .copy(ruta, ruta, { destinationBucket: 'comprobantes-respaldo' })
      if (errorCopia) {
        console.error(`No se pudo respaldar ${ruta}:`, errorCopia)
        errores++
      } else {
        copiados++
      }
    }
  }

  return new Response(JSON.stringify({ copiados, yaExistian, errores }), { status: 200 })
})
