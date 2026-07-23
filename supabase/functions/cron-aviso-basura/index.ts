// Sol Estudio Hab — Edge Function: cron-aviso-basura
//
// Job de martes, jueves y sábado (ver README para la programación con
// pg_cron). Avisa a todos los huéspedes activos que hoy es día de sacar
// la basura, por correo, push y en el centro de notificaciones de la app.
//
// Requiere los secrets: CRON_SECRET, RESEND_API_KEY, CORREO_REMITENTE,
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (ver README).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarCorreo } from '../_shared/correo.ts'
import { enviarPushAHuesped } from '../_shared/push.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: huespedes, error } = await supabase
    .from('huespedes')
    .select('id, correo, nombres')
    .eq('activo', true)

  if (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let enviados = 0
  for (const huesped of huespedes ?? []) {
    await supabase
      .from('notificaciones')
      .insert({ huesped_id: huesped.id, tipo: 'aviso_basura', canal: 'app', mes_referencia: null })

    const claimCorreo = await supabase
      .from('notificaciones')
      .insert({ huesped_id: huesped.id, tipo: 'aviso_basura', canal: 'correo', mes_referencia: null })
      .select('id')
      .single()
    if (!claimCorreo.error) {
      await enviarCorreo({
        to: [huesped.correo],
        subject: 'Hoy es día de sacar la basura — Sol Estudio Hab',
        html: `<p>Hola ${huesped.nombres},</p>
               <p>Te recordamos que hoy es día de sacar la basura en Sol Estudio Hab.</p>
               <p>Gracias por tu colaboración.</p>`,
      })
    }

    const claimPush = await supabase
      .from('notificaciones')
      .insert({ huesped_id: huesped.id, tipo: 'aviso_basura', canal: 'push', mes_referencia: null })
      .select('id')
      .single()
    if (!claimPush.error) {
      await enviarPushAHuesped(supabase, huesped.id, {
        title: 'Sacar la basura 🗑️',
        body: 'Hoy es día de sacar la basura en Sol Estudio Hab.',
      })
    }

    enviados++
  }

  return new Response(JSON.stringify({ enviados }), { status: 200 })
})
