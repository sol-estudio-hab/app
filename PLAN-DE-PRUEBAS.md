# Plan de pruebas — Sol Estudio Hab

Matriz de casos de prueba y criterios de aceptación por historia de usuario (Fase 6, T6.1).
Complementa las pruebas automatizadas (`npm test`, `npm run test:seguridad`, `e2e/`).

Leyenda de estado: ✅ automatizado · 🔍 manual (ver checklist de dispositivos) · — pendiente.

## 1. Registro de huésped

**Historia:** como huésped, quiero registrarme con mis datos del acuerdo para empezar a usar la app.

| # | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|
| 1.1 | Registro con los 4 campos obligatorios + correo/contraseña válidos | Positivo | Cuenta creada, correo de confirmación enviado | ✅ e2e |
| 1.2 | Falta un campo obligatorio | Negativo | Error de validación, no se envía el formulario | 🔍 |
| 1.3 | Correo con formato inválido | Negativo (borde) | Rechazado por Supabase Auth, mensaje traducido | ✅ (verificado en Fase 2 con dominios inválidos) |
| 1.4 | Contraseñas no coinciden | Negativo | Error "Las contraseñas no coinciden" | ✅ e2e |
| 1.5 | Meses del acuerdo = 0 o negativo | Borde | El input (min=1) bloquea el envío a nivel del navegador | ✅ e2e |
| 1.6 | Correo ya registrado | Negativo | No revela si existe (anti-enumeración), muestra "revisa tu correo" igual | 🔍 |
| 1.7 | Reinstalar la app y volver a iniciar sesión con la misma cuenta | Positivo | Perfil y acuerdo se recuperan desde la BD, no hay que registrarse de nuevo | ✅ e2e |

**Criterio de aceptación:** un huésped nuevo solo puede completar el registro con los 4 campos + credenciales válidas; cualquier dato faltante o inválido bloquea el envío con un mensaje en español.

## 2. Autenticación

| # | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|
| 2.1 | Login con credenciales correctas | Positivo | Redirige a Inicio con el nombre del huésped | ✅ e2e |
| 2.2 | Login con contraseña incorrecta | Negativo | "Correo o contraseña incorrectos" | 🔍 |
| 2.3 | Login sin confirmar el correo | Negativo | "Debes confirmar tu correo antes de iniciar sesión" | 🔍 |
| 2.4 | Recuperar contraseña con correo registrado | Positivo | Envía enlace, no confirma si el correo existe | ✅ (verificado manualmente en Fase 2) |
| 2.5 | Acceder a `/pagos`, `/perfil`, `/notificaciones` sin sesión | Negativo | Redirige a `/ingresar` | ✅ e2e + manual |
| 2.6 | Acceder a `/admin` sin ser administrador | Negativo | Redirige a `/` | ✅ (RutaAdmin, verificado en Fase 3) |

## 3. Calendario y carga de pagos

| # | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|
| 3.1 | Mes con fecha de vencimiento futura, sin pago | Positivo | Estado "Pendiente" | ✅ unitario (`calendario.test.ts`) |
| 3.2 | Mes vencido sin comprobante | Borde | Estado "Vencido" | ✅ unitario |
| 3.3 | Mismo día del vencimiento, sin comprobante | Borde | Todavía "Pendiente", no "Vencido" | ✅ unitario |
| 3.4 | Subir comprobante válido (jpg/png/webp/pdf, <10MB) | Positivo | Estado pasa a "En revisión", correo al admin | ✅ e2e + manual real |
| 3.5 | Subir archivo de tipo no permitido | Negativo | "Solo se aceptan imágenes... o PDF" | 🔍 |
| 3.6 | Subir archivo > 10MB | Negativo | "El archivo supera el tamaño máximo de 10 MB" | 🔍 |
| 3.7 | Reemplazar un comprobante ya cargado | Positivo | Pide confirmación antes de reemplazar | 🔍 |
| 3.8 | Ver comprobante propio | Positivo | Abre con URL firmada temporal | ✅ manual |
| 3.9 | Acuerdo con día 31 + mes de 28/29/30 días | Borde | Vencimiento se recorta al último día del mes | ✅ unitario |
| 3.10 | Fecha de ingreso el 31 de enero de un año bisiesto | Borde | Vencimiento de febrero es el 29, no el 28 | ✅ unitario |

## 4. Panel administrador

| # | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|
| 4.1 | Listado de huéspedes con estado del mes actual | Positivo | Muestra habitación, nombre, correo, estado, activo | ✅ manual |
| 4.2 | Verificar un pago cargado | Positivo | Estado pasa a "Pagado", ya no editable por el huésped | ✅ manual + seguridad |
| 4.3 | Rechazar un pago con motivo | Positivo | Estado "Rechazado", huésped ve el motivo y puede volver a subir | 🔍 |
| 4.4 | Editar fecha de ingreso / meses del acuerdo de un huésped | Positivo | Recalcula el calendario de pagos | 🔍 |
| 4.5 | Desactivar manualmente una cuenta | Positivo | `activo=false`, deja de aparecer como pendiente en reportes | 🔍 |

## 5. Notificaciones automáticas (Fase 4)

| # | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|
| 5.1 | Día de pago + 2 días sin comprobante | Positivo | Notificación "recordatorio" por correo, push y en la app | — (lógica cubierta por unitarios de `calendario`; el cron en sí no se pudo forzar con datos reales, ver Fase 4) |
| 5.2 | Día de pago + 6 días sin comprobante | Positivo | Notificación "mora" | — |
| 5.3 | Se cumplen los meses del acuerdo | Positivo | Acuerdo `finalizado`, huésped `inactivo`, aviso de fin de acuerdo | — |
| 5.4 | Aviso de sacar la basura (martes/jueves/sábado) | Positivo | Todos los huéspedes activos reciben correo + push + notificación en la app | ✅ probado con invocación manual real |
| 5.5 | Reintento de correo si Resend falla | Positivo | Hasta 2 intentos antes de registrar el fallo en logs | ✅ (código, `enviarCorreo`) |
| 5.6 | Ejecutar el mismo cron dos veces el mismo día | Borde | No duplica la notificación (índice único `notificaciones_idempotencia`) | ✅ unitario (índice) + diseño |

## 6. Reportes (Fase 5)

| # | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|
| 6.1 | Cambiar el mes del reporte | Positivo | Resumen y tabla se recalculan para ese mes | ✅ manual |
| 6.2 | Exportar CSV | Positivo | Archivo con encabezados y datos correctos, se abre bien en Excel (BOM UTF-8) | ✅ manual |
| 6.3 | Huésped sin acuerdo ese mes | Borde | Fila muestra "—" en estado, no rompe el reporte | 🔍 |

## 7. Seguridad (RLS)

Automatizado en [tests/seguridad.test.ts](tests/seguridad.test.ts) — ejecutar con `npm run test:seguridad`.

| # | Caso | Resultado esperado | Estado |
|---|---|---|---|
| 7.1 | Cliente sin sesión lee `huespedes` / `pagos` / `admins` | 0 filas | ✅ |
| 7.2 | Huésped consulta `huespedes` sin filtro | Solo su propia fila | ✅ |
| 7.3 | Huésped lee `admins` | 0 filas | ✅ |
| 7.4 | Huésped intenta insertarse en `admins` | Error de RLS | ✅ |
| 7.5 | Huésped intenta marcar su propio pago como "verificado" | Rechazado, sigue "cargado" | ✅ |
| 7.6 | Administrador lee todos los `huespedes` | Devuelve todas las filas | ✅ |
| 7.7 | Huésped genera URL firmada de un comprobante ajeno | Error | ✅ |

## 8. Pruebas en dispositivos (T6.4)

Ver checklist separado: [CHECKLIST-DISPOSITIVOS.md](CHECKLIST-DISPOSITIVOS.md). Requiere ejecución manual —
no automatizable desde este entorno (sin dispositivo Android físico ni navegadores adicionales).
