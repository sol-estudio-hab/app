import { registerSW } from 'virtual:pwa-register'

const REVISAR_ACTUALIZACION_MS = 60 * 1000

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // El navegador solo revisa actualizaciones al navegar; si el usuario
      // deja la pestaña abierta, forzamos la revisión cada minuto.
      setInterval(() => registration.update(), REVISAR_ACTUALIZACION_MS)
    },
  })

  // Cuando el nuevo service worker toma control (gracias a skipWaiting +
  // clientsClaim en sw.ts), recargamos para que la pestaña abierta cargue
  // el JS nuevo, sin que el usuario tenga que hacerlo manualmente.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}
