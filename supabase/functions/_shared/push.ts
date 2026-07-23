// Helper compartido para enviar notificaciones Web Push (VAPID) a las
// suscripciones guardadas en push_subscriptions.

import webpush from 'npm:web-push@3'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notificaciones@solestudiohab.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

interface Suscripcion {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Envía un push a todas las suscripciones de un huésped; borra las que ya no sirven (410/404). */
export async function enviarPushAHuesped(
  supabase: SupabaseClient,
  huespedId: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('huesped_id', huespedId)
  const suscripciones = (data ?? []) as Suscripcion[]

  let enviados = 0
  for (const s of suscripciones) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        JSON.stringify(payload),
      )
      enviados++
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        console.error('Error enviando push:', error)
      }
    }
  }
  return enviados
}
