/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// Sin esto, un service worker nuevo se queda "esperando" hasta que el
// usuario cierre todas las pestañas de la app — puede tardar días en verse
// un cambio. skipWaiting + clientsClaim lo activan de inmediato.
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

interface PayloadPush {
  title: string
  body: string
  url?: string
}

self.addEventListener('push', (evento) => {
  if (!evento.data) return
  const datos = evento.data.json() as PayloadPush
  evento.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: datos.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = (evento.notification.data?.url as string) ?? '/'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        if (cliente.url.includes(url) && 'focus' in cliente) return cliente.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
