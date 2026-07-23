# Plan de Trabajo — Sol Estudio Hab

Aplicación de gestión de pagos de arriendo para los huéspedes de las habitaciones de **Sol Estudio Hab**.

---

## 1. Visión general

| Aspecto | Definición |
|---|---|
| Producto | App instalable en Android + versión web idéntica (misma base de código) |
| Usuarios | Huéspedes (suben comprobantes) y Administrador (recibe y controla pagos) |
| Objetivo | Registrar pagos mensuales con comprobante, notificar vencimientos y centralizar toda la información en una única base de datos |
| Fuente de datos | Una sola BD en la nube (sin duplicidad app/web) |

### Alcance funcional (requisitos)

1. **Registro de huésped** con campos obligatorios: correo electrónico, número de habitación, nombres, fecha de ingreso y número de meses del acuerdo firmado.
2. **Carga de comprobante de pago** (imagen o PDF) indicando el mes que paga.
3. **Notificaciones** al huésped (correo + notificación en la app) cuando se acerca o vence la fecha de pago, o cuando no ha subido el comprobante.
4. **Correo al administrador** con el comprobante adjunto, el mes pagado y el correo del huésped que pagó.
5. **Persistencia centralizada**: si el usuario reinstala la app, al iniciar sesión recupera toda su información (no se vuelve a pedir el registro).
6. **Conteo de meses del acuerdo**: con fecha de ingreso + meses firmados se calcula el calendario de pagos y cuántos meses van pagados / pendientes.
7. **Seguridad**: autenticación obligatoria, cifrado en tránsito y en reposo, cada huésped solo ve su información.
8. **Respaldo en disco**: los comprobantes se guardan en almacenamiento de archivos y se respaldan periódicamente.

---

## 2. Arquitectura propuesta

**Decisión clave: una sola aplicación PWA (Progressive Web App).**
Una PWA se usa desde el navegador y **se instala en Android** como una app (con ícono, pantalla completa y notificaciones push). Esto garantiza que "app y web sean idénticas" porque **son el mismo código**, y elimina el costo de mantener dos desarrollos. Opcionalmente se empaqueta como TWA para publicarla en Google Play.

```
┌─────────────────────────────┐
│  PWA (React + TypeScript)   │  ← navegador y Android (instalable)
│  UI huésped / UI admin      │
└──────────────┬──────────────┘
               │ HTTPS (TLS)
┌──────────────▼──────────────┐
│  Supabase (backend)         │
│  ├─ Auth (correo+contraseña,│
│  │   recuperación de cuenta)│
│  ├─ PostgreSQL (BD única)   │
│  │   + RLS (cada usuario    │
│  │     solo ve lo suyo)     │
│  ├─ Storage (comprobantes)  │
│  └─ Edge Functions + Cron   │
│     (recordatorios, correos)│
└──────────────┬──────────────┘
               │
   ┌───────────┴───────────┐
   │ Resend / SendGrid     │  ← correos con adjunto
   │ Web Push (FCM)        │  ← notificaciones push
   └───────────────────────┘
```

### Stack recomendado

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + TypeScript + Vite + PWA (service worker) | Un solo código para web y Android; tipado fuerte |
| UI | Tailwind CSS + componentes accesibles | Diseño consistente y responsive |
| Backend / BD | Supabase (PostgreSQL gestionado) | BD única centralizada, Auth integrada, Row Level Security, Storage, funciones programadas — costo casi cero para este volumen |
| Archivos | Supabase Storage (bucket privado) | Comprobantes protegidos por políticas de acceso |
| Correo | Resend o SendGrid (desde Edge Function) | Envío con adjuntos, plantillas |
| Push | Web Push / Firebase Cloud Messaging | Notificaciones en Android y navegador |
| Recordatorios | pg_cron / Scheduled Edge Functions | Job diario que evalúa vencimientos |
| Hosting web | Vercel o Netlify (HTTPS automático) | Despliegue continuo desde Git |
| Control de versiones | Git + GitHub | CI/CD, revisión de código |

*Alternativa equivalente:* Firebase (Auth + Firestore + Storage + Functions). Se elige Supabase por usar **PostgreSQL relacional**, más adecuado para reportes y conteo de meses.

### Modelo de datos (inicial)

```
huespedes
  id (uuid, = auth.user_id)
  correo            (único, obligatorio)
  nombres           (obligatorio)
  numero_habitacion (obligatorio)
  activo            (bool)  -- pasa a false al terminar el acuerdo sin renovar
  creado_en / actualizado_en

acuerdos                       -- permite renovaciones conservando el historial
  id (uuid)
  huesped_id     → huespedes.id
  fecha_ingreso  (date, obligatorio; igual a la fecha del acuerdo firmado)
  meses_acuerdo  (obligatorio, entero > 0)
  dia_pago       (derivado: día del mes de fecha_ingreso)
  estado         (activo | finalizado)
  creado_en

pagos
  id (uuid)
  acuerdo_id  → acuerdos.id
  mes_pagado  (YYYY-MM)          -- único por acuerdo
  archivo_url (ruta en Storage)
  estado      (pendiente | cargado | verificado | rechazado)
  fecha_carga
  verificado_por / fecha_verificacion
  observaciones

notificaciones
  id, huesped_id, tipo (recordatorio | mora | confirmacion | fin_acuerdo),
  canal (correo | push | app), mes_referencia, enviado_en, leido

admins
  id (uuid, = auth.user_id), correo, nombres

auditoria
  id, usuario_id, accion, entidad, detalle (jsonb), fecha
```

**Reglas de negocio clave (confirmadas 2026-07-17)**

- **Día de pago individual por huésped:** es el día del mes de la `fecha_ingreso` (campo tipo fecha, igual a la fecha del acuerdo firmado). Cada huésped tiene su propia fecha; no hay día fijo global.
- Calendario de pagos = `fecha_ingreso` + N meses (`meses_acuerdo`). Cada mes genera una obligación.
- **Recordatorio (día de pago + 2 días):** si no hay comprobante cargado, se envía correo + push indicando que es un *recordatorio* de pago.
- **Mora (día de pago + 6 días):** si sigue sin comprobante, se envía correo + push indicando que está *en mora*: "favor realizar el pago y subir el archivo, o si ya realizó el pago, subir el comprobante".
- Un pago queda "cargado" al subir comprobante y "verificado" cuando el admin lo confirma.
- Al cargar un comprobante: correo automático al administrador con el archivo adjunto, mes pagado y correo del huésped.
- **Fin del acuerdo:** al cumplirse los meses firmados se notifica preguntando si va a renovar y el huésped se marca como **inactivo**. Para renovar, realiza el flujo de registro de acuerdo nuevamente (nueva fecha de ingreso y nuevo número de meses). La cuenta y el historial de pagos se conservan — solo se crea un **nuevo acuerdo** (ver tabla `acuerdos`).

### Seguridad de la información

- Autenticación obligatoria (correo + contraseña, verificación de correo, recuperación de contraseña).
- **Row Level Security (RLS)** en PostgreSQL: cada huésped solo lee/escribe sus propios registros; el admin tiene rol propio.
- Bucket de Storage **privado**: los comprobantes solo se acceden con URL firmada temporal.
- TLS en todas las comunicaciones; cifrado en reposo provisto por la plataforma.
- Validación de archivos en servidor: tipo (jpg/png/pdf), tamaño máximo (p. ej. 10 MB), renombrado seguro (`{huesped_id}/{YYYY-MM}.ext`).
- Sin secretos en el frontend: llaves de correo/push solo en Edge Functions.
- Auditoría de acciones sensibles (verificación/rechazo de pagos, cambios de datos).
- Respaldo: backups automáticos de la BD + job de exportación periódica de comprobantes a disco/almacenamiento frío.

---

## 3. Roles del equipo

| Rol | Responsabilidad |
|---|---|
| **Arquitecto de software** | Stack, modelo de datos, seguridad, decisiones técnicas, revisión de diseño |
| **Analista de datos / negocio** | Requisitos, reglas de negocio (calendario de pagos, estados), reportes y métricas |
| **Desarrollador senior frontend** | PWA, UI huésped y admin, service worker, instalación Android |
| **Desarrollador senior backend** | BD, RLS, Edge Functions, correos, notificaciones, cron |
| **QA** | Plan de pruebas, criterios de aceptación, pruebas de seguridad y regresión |
| **Tester / Validaciones** | Ejecución de casos de prueba manuales y automatizados, pruebas en dispositivos Android reales |
| **DevOps / Seguridad** | CI/CD, despliegues, backups, monitoreo, revisión de políticas de acceso |

---

## 4. Fases, tareas y subtareas

> Cada fase es ejecutable como un proceso independiente. Los entregables de una fase son insumo de la siguiente. Estimaciones en días hábiles de trabajo efectivo.

### FASE 0 — Análisis y definición (Analista + Arquitecto) — 2-3 días

- **T0.1 Levantamiento de requisitos**
  - S0.1.1 Documentar historias de usuario (huésped y admin) con criterios de aceptación.
  - S0.1.2 Definir reglas de negocio: día exacto de pago, días de gracia, qué pasa al terminar el acuerdo (renovación), monto del arriendo (¿fijo por habitación?).
  - S0.1.3 Definir política de recordatorios (cuántos días antes, frecuencia si está vencido).
- **T0.2 Definición de datos**
  - S0.2.1 Validar el modelo de datos con el negocio (campos obligatorios del registro).
  - S0.2.2 Definir estados del pago y quién puede cambiarlos.
- **T0.3 Diseño UX**
  - S0.3.1 Wireframes: registro, login, inicio (estado de pagos), subir comprobante, historial, panel admin.
  - S0.3.2 Validar flujo con un usuario real.

**Entregables:** documento de requisitos, reglas de negocio, wireframes aprobados.

### FASE 1 — Arquitectura y fundaciones (Arquitecto + DevOps) — 2-3 días

- **T1.1 Repositorio y proyecto**
  - S1.1.1 Crear repositorio Git (GitHub) con ramas `main`/`develop` y protección de rama.
  - S1.1.2 Inicializar proyecto React + TypeScript + Vite + PWA; linting (ESLint), formato (Prettier), hooks de pre-commit.
  - S1.1.3 Configurar CI (GitHub Actions): lint + tests + build en cada PR.
- **T1.2 Backend Supabase**
  - S1.2.1 Crear proyecto Supabase (entornos: desarrollo y producción).
  - S1.2.2 Crear migraciones SQL del modelo de datos (versionadas en el repo).
  - S1.2.3 Escribir políticas RLS por tabla y probarlas con tests SQL.
  - S1.2.4 Crear bucket privado de comprobantes con políticas de acceso.
- **T1.3 Servicios externos**
  - S1.3.1 Cuenta y dominio verificado en Resend/SendGrid; plantillas base de correo.
  - S1.3.2 Configurar proyecto FCM / llaves VAPID para Web Push.

**Entregables:** repo con CI, BD migrada con RLS, servicios de correo y push configurados.

### FASE 2 — Autenticación y registro (Backend + Frontend senior) — 4-5 días

- **T2.1 Autenticación**
  - S2.1.1 Registro con correo + contraseña y verificación de correo.
  - S2.1.2 Inicio de sesión, cierre de sesión, sesión persistente.
  - S2.1.3 Recuperación de contraseña por correo.
- **T2.2 Perfil del huésped**
  - S2.2.1 Formulario de registro con campos obligatorios (correo, habitación, nombres, fecha de ingreso, meses del acuerdo) y validaciones en cliente **y** servidor.
  - S2.2.2 Al iniciar sesión en cualquier dispositivo, recuperar el perfil desde la BD (reinstalación sin re-registro).
  - S2.2.3 Pantalla "Mi perfil" (solo lectura para el huésped; edición solo por admin).
- **T2.3 Roles**
  - S2.3.1 Rol administrador con acceso al panel admin; huéspedes sin acceso a datos ajenos (verificado por RLS).

**Entregables:** flujo completo de cuenta funcionando en dev; pruebas de RLS pasando.

### FASE 3 — Módulo de pagos (Backend + Frontend senior) — 5-6 días

- **T3.1 Calendario de obligaciones**
  - S3.1.1 Generar automáticamente los N meses del acuerdo a partir de fecha de ingreso.
  - S3.1.2 Pantalla de inicio del huésped: estado de cada mes (pagado ✔ / pendiente ⏳ / vencido ⚠), meses transcurridos vs. meses del acuerdo.
- **T3.2 Carga de comprobante**
  - S3.2.1 Subida de archivo (foto o PDF) con selección del mes que paga; validación de tipo y tamaño.
  - S3.2.2 Guardar en Storage privado con ruta `{huesped_id}/{YYYY-MM}`; registrar el pago en la BD.
  - S3.2.3 Evitar duplicados: un comprobante por mes (reemplazo con confirmación).
  - S3.2.4 Historial de pagos con visualización del comprobante (URL firmada temporal).
- **T3.3 Correo al administrador**
  - S3.3.1 Edge Function que al registrarse un pago envía correo al admin con: comprobante adjunto, mes pagado, correo y nombre del huésped, habitación.
  - S3.3.2 Reintentos ante fallo de envío y registro en tabla `notificaciones`.
- **T3.4 Panel administrador**
  - S3.4.1 Listado de huéspedes con estado de pago del mes actual.
  - S3.4.2 Detalle por huésped: comprobantes, verificar/rechazar pago con observaciones.
  - S3.4.3 Alta/edición de huéspedes y ajuste de día de pago.

**Entregables:** flujo completo huésped-sube → admin-recibe-correo → admin-verifica.

### FASE 4 — Notificaciones y recordatorios (Backend senior) — 3-4 días

- **T4.1 Job programado diario (cron)**
  - S4.1.1 Día de pago + 2 días sin comprobante → notificación tipo *recordatorio*.
  - S4.1.2 Día de pago + 6 días sin comprobante → notificación tipo *mora*: "favor realizar el pago y subir el archivo, o si ya realizó el pago, subir el comprobante".
  - S4.1.3 Al cumplirse los meses del acuerdo → notificación *fin de acuerdo* (¿renovar?) y marcar huésped como inactivo; si renueva, flujo de nuevo acuerdo (nueva fecha y meses).
  - S4.1.4 Idempotencia: no notificar dos veces lo mismo el mismo día.
- **T4.2 Canales**
  - S4.2.1 Correo al huésped (plantillas con nombre, mes y fecha límite).
  - S4.2.2 Push en la app/navegador (suscripción al instalar, permiso explícito).
  - S4.2.3 Centro de notificaciones dentro de la app (leídas/no leídas).

**Entregables:** recordatorios automáticos funcionando en los tres canales.

### FASE 5 — Reportes y datos (Analista de datos + Backend) — 2-3 días

- **T5.1 Reportes del admin**
  - S5.1.1 Resumen mensual: pagados, pendientes, vencidos por habitación.
  - S5.1.2 Avance de acuerdo por huésped (meses pagados / meses firmados).
  - S5.1.3 Exportación a Excel/CSV.
- **T5.2 Respaldo**
  - S5.2.1 Verificar backups automáticos de la BD y definir retención.
  - S5.2.2 Job de exportación periódica de comprobantes (copia a disco/almacenamiento secundario).

**Entregables:** panel de reportes y política de respaldo operativa.

### FASE 6 — QA, pruebas y validaciones (QA + Tester) — 4-5 días (en paralelo desde Fase 2)

- **T6.1 Plan de pruebas**
  - S6.1.1 Matriz de casos de prueba por historia de usuario (positivos, negativos y de borde).
  - S6.1.2 Criterios de aceptación verificables por funcionalidad.
- **T6.2 Pruebas automatizadas**
  - S6.2.1 Tests unitarios (lógica de calendario de pagos, validaciones) — cobertura mínima 80 % en lógica de negocio.
  - S6.2.2 Tests de integración de API/Edge Functions.
  - S6.2.3 Tests E2E (Playwright): registro → carga de pago → verificación admin.
- **T6.3 Pruebas de seguridad**
  - S6.3.1 Intentos de acceso a datos de otro huésped (RLS), URLs de Storage sin firma, inyección en formularios.
  - S6.3.2 Revisión de dependencias vulnerables (npm audit) en CI.
- **T6.4 Pruebas en dispositivos**
  - S6.4.1 Instalación PWA en Android (Chrome), notificaciones push, uso offline básico.
  - S6.4.2 Navegadores de escritorio (Chrome, Edge, Firefox) y móviles.
  - S6.4.3 Pruebas de usabilidad con 1-2 huéspedes reales antes de salir a producción.

**Entregables:** suite de pruebas en CI, informe de QA, bugs críticos en cero.

### FASE 7 — Despliegue y publicación (DevOps) — 2-3 días

- **T7.1 Producción web**
  - S7.1.1 Desplegar en Vercel/Netlify con dominio propio y HTTPS.
  - S7.1.2 Variables de entorno de producción; separación total de dev/prod.
  - S7.1.3 Monitoreo de errores (Sentry) y alertas de fallos de correo/cron.
- **T7.2 Android**
  - S7.2.1 Verificar instalación PWA desde el navegador ("Agregar a pantalla de inicio"). **Decisión: se inicia solo con PWA.**
  - S7.2.2 (Etapa posterior) Empaquetar la misma PWA como TWA con Bubblewrap y publicar en Google Play.
- **T7.3 Puesta en marcha**
  - S7.3.1 Cargar huéspedes actuales (migración inicial de datos).
  - S7.3.2 Guía rápida de uso para huéspedes (1 página) y para el admin.
  - S7.3.3 Piloto de 1 ciclo de pago con todos los huéspedes.

**Entregables:** aplicación en producción, huéspedes registrados, primer ciclo operando.

### FASE 8 — Mantenimiento (continuo)

- Revisión mensual de backups y restauración de prueba.
- Monitoreo de entrega de correos y push.
- Backlog de mejoras (pagos en línea, recibos automáticos, multi-propiedad).

---

## 5. Resumen de cronograma

| Fase | Duración | Dependencia |
|---|---|---|
| 0. Análisis | 2-3 días | — |
| 1. Arquitectura | 2-3 días | Fase 0 |
| 2. Autenticación | 4-5 días | Fase 1 |
| 3. Pagos | 5-6 días | Fase 2 |
| 4. Notificaciones | 3-4 días | Fase 3 |
| 5. Reportes | 2-3 días | Fase 3 |
| 6. QA | 4-5 días | En paralelo desde Fase 2 |
| 7. Despliegue | 2-3 días | Fases 4-6 |
| **Total** | **≈ 5-6 semanas** | |

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Correos caen en spam | Dominio verificado con SPF/DKIM; monitorear entregabilidad |
| Push no llega en algunos Android | El correo es siempre el canal garantizado; push es complemento |
| Huésped sube archivo ilegible | Vista previa antes de enviar; admin puede rechazar con observación |
| Pérdida de datos | Backups automáticos + exportación periódica + restauración de prueba mensual |
| Un solo desarrollador real | Fases pequeñas y entregables independientes; cada fase deja algo usable |

## 7. Decisiones confirmadas (2026-07-17)

1. **Día de pago:** el día del mes de la fecha de ingreso de cada huésped (fecha del acuerdo firmado, campo tipo fecha). Fechas distintas por huésped.
2. **Recordatorio:** día de pago + 2 días sin comprobante → mensaje de *recordatorio*.
3. **Mora:** día de pago + 6 días sin comprobante → mensaje de *mora* ("realizar el pago y subir el archivo, o si ya pagó, subir el comprobante").
4. **Fin del acuerdo:** se notifica preguntando si renueva; el huésped queda **inactivo** y para renovar repite el flujo de registro de acuerdo (nueva fecha de ingreso y nuevo número de meses). La cuenta y el historial se conservan mediante la tabla `acuerdos`.
5. **Distribución:** se inicia solo con PWA (instalable desde el navegador); Google Play (TWA) queda para una etapa posterior.

### Pregunta pendiente

- ¿El monto del arriendo es fijo por habitación? ¿Debe registrarse y validarse contra el comprobante? (No bloquea las Fases 1-2.)
