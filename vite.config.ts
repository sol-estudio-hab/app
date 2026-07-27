import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // Registramos el service worker a mano en src/registrarSW.ts para
      // poder revisar actualizaciones periódicamente y recargar sin que
      // el usuario tenga que hacer Ctrl+F5.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Sol Estudio Hab — Pagos',
        short_name: 'Sol Estudio',
        description: 'Gestión de pagos de arriendo de Sol Estudio Hab',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f766e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
