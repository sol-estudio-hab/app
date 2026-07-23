import { getSupabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const vista = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) vista[i] = rawData.charCodeAt(i)
  return buffer
}

export function pushSoportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/** Solicita permiso y registra la suscripción push del huésped en la BD. */
export async function activarNotificacionesPush(
  huespedId: string,
): Promise<{ error: string | null }> {
  if (!pushSoportado()) {
    return { error: 'Este navegador no soporta notificaciones push.' }
  }
  if (!VAPID_PUBLIC_KEY) {
    return { error: 'Falta configurar VITE_VAPID_PUBLIC_KEY.' }
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    return { error: 'Permiso de notificaciones denegado.' }
  }

  const registro = await navigator.serviceWorker.ready
  const suscripcionExistente = await registro.pushManager.getSubscription()
  const suscripcion =
    suscripcionExistente ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = suscripcion.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { error: 'No se pudo obtener la suscripción push.' }
  }

  const { error } = await getSupabase()
    .from('push_subscriptions')
    .upsert(
      {
        huesped_id: huespedId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' },
    )

  return { error: error?.message ?? null }
}

/** true si ya existe una suscripción push activa en este navegador. */
export async function tieneSuscripcionPush(): Promise<boolean> {
  if (!pushSoportado()) return false
  const registro = await navigator.serviceWorker.ready
  const suscripcion = await registro.pushManager.getSubscription()
  return suscripcion !== null
}
