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

// Estructura basada en tablas con estilos en línea: es lo que hace falta
// para que el correo se vea igual en Gmail, Outlook y demás clientes, que
// ignoran o recortan las hojas de estilo normales.
function plantillaAvisoBasura(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background-color:#0f766e;padding:20px 24px;">
                <span style="font-size:20px;vertical-align:middle;">🗑️</span>
                <span style="color:#ffffff;font-size:18px;font-weight:bold;vertical-align:middle;margin-left:8px;">Sol Estudio Hab</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#1f2937;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 16px;">Buen día.</p>
                <p style="margin:0 0 16px;"><strong>Hoy es día de sacar la basura.</strong></p>
                <p style="margin:0 0 16px;">Recuerden que se realiza los martes, jueves y sábados en la mañana, especialmente la generada en la cocina.</p>
                <p style="margin:0 0 16px;">Mantener las zonas comunes libres de basura es responsabilidad de todos.</p>
                <p style="margin:0;">Gracias por sostener el orden y la limpieza.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background-color:#f8fafc;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">
                — Administración<br>
                Sol Estudio Hab
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: huespedes, error } = await supabase
    .from('huespedes')
    .select('id, correo')
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
        html: plantillaAvisoBasura(),
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
