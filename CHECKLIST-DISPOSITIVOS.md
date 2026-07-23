# Checklist de pruebas en dispositivos (T6.4)

Estas pruebas requieren un dispositivo Android físico y varios navegadores reales — no se pueden
ejecutar desde este entorno de desarrollo. Márcalas a mano según las vayas completando.

## Instalación PWA en Android (Chrome) — S6.4.1

- [ ] Abrir la URL de producción en Chrome para Android.
- [ ] Verificar que aparece el banner o la opción "Agregar a pantalla de inicio" / "Instalar app".
- [ ] Instalar y confirmar que el ícono en la pantalla de inicio es el girasol correcto.
- [ ] Abrir la app instalada y confirmar que abre en modo standalone (sin barra del navegador).
- [ ] Iniciar sesión como huésped y activar notificaciones push desde "Mi perfil".
- [ ] Subir un comprobante y verificar que llega el correo al administrador.
- [ ] Provocar (o esperar) un recordatorio/mora y confirmar que llega la notificación push al
      dispositivo con la app cerrada.
- [ ] Poner el dispositivo en modo avión, abrir la app instalada: debe cargar el shell básico
      (aunque las peticiones a Supabase fallarán sin conexión — confirmar que no se cae en blanco).

## Navegadores de escritorio — S6.4.2

Para cada navegador, repetir: registro → confirmación de correo → login → subir comprobante →
panel admin → verificar pago → cerrar sesión.

- [ ] Google Chrome (última versión)
- [ ] Microsoft Edge (última versión)
- [ ] Mozilla Firefox (última versión)

Puntos a revisar en cada uno:
- [ ] El menú hamburguesa aparece y funciona correctamente en ventana angosta.
- [ ] Las notificaciones push se pueden activar (Firefox y Safari tienen soporte distinto a Chrome).
- [ ] Los formularios de fecha (`<input type="date">` / `type="month"`) se ven bien.

## Navegadores móviles — S6.4.2

- [ ] Safari en iPhone (iOS no soporta instalación PWA completa ni Web Push de la misma forma que
      Android — confirmar qué funciona y documentar la limitación para los huéspedes con iPhone).
- [ ] Chrome en Android (además de la instalación como PWA, probar también solo como pestaña del
      navegador, sin instalar).

## Usabilidad con huéspedes reales — S6.4.3

- [ ] Sesión de prueba con 1-2 huéspedes reales antes de salir a producción: pedirles registrarse,
      subir un comprobante y revisar sus notificaciones sin más ayuda que la guía rápida de uso.
- [ ] Anotar cualquier punto donde se confundan o se atoren — son candidatos a ajustar antes de la
      Fase 7.
