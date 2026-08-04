# Sol Estudio Hab — Pagos

Aplicación PWA (web + instalable en Android) para gestionar los pagos de arriendo
de los huéspedes de las habitaciones de **Sol Estudio Hab**.

El plan de trabajo completo, la arquitectura y las reglas de negocio están en
[PLAN-DE-TRABAJO.md](PLAN-DE-TRABAJO.md).

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 + `vite-plugin-pwa`
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Storage + Edge Functions)
- **Correo:** Resend/SendGrid (Fase 3) · **Push:** Web Push/FCM (Fase 4)

## Configuración local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear el archivo de entorno a partir del ejemplo y completar con las
   credenciales del proyecto Supabase (Project Settings → API):

   ```bash
   copy .env.example .env
   ```

   > `.env` nunca se sube al repositorio.

3. Aplicar las migraciones de la carpeta [supabase/migrations](supabase/migrations)
   al proyecto Supabase (SQL Editor o CLI de Supabase, en orden numérico).

4. Configurar Supabase Auth (Authentication → URL Configuration):
   - **Site URL:** `http://localhost:5173` en desarrollo (cambiar al dominio real en producción).
   - **Redirect URLs:** agregar `http://localhost:5173/**` (y el dominio de producción) para que
     funcionen los enlaces de confirmación de correo y de restablecer contraseña.
   - "Confirm email" viene activado por defecto: el huésped debe confirmar su correo antes de
     poder iniciar sesión.

5. Dar de alta al administrador (no se hace desde el formulario de registro, para no crearle un
   perfil de huésped): crear el usuario desde Authentication → Users → Add user, copiar su UID y
   ejecutar en el SQL Editor. En este proyecto el correo administrador es siempre
   `aguasclaras713@gmail.com`:

   ```sql
   insert into public.admins (id, correo, nombres)
   values ('<uid-del-usuario>', 'aguasclaras713@gmail.com', 'Administrador Sol Estudio Hab');
   ```

6. Ejecutar en desarrollo:

   ```bash
   npm run dev
   ```

## Correo propio con Resend (quita el límite de 2-3 correos/hora y habilita el correo al admin)

Mientras no se configure un proveedor SMTP propio, Supabase usa un servidor de correo compartido
limitado a **2-3 correos por hora** para los correos de Auth (confirmación de cuenta, recuperar
contraseña) — suficiente para una demo puntual, pero se agota enseguida con pruebas repetidas.
[Resend](https://resend.com) resuelve esto de forma permanente y además es el proveedor que usa la
Edge Function que le avisa al administrador cuando un huésped sube un comprobante.

1. **Crear una cuenta en Resend** y obtener una API key (Dashboard → API Keys → Create API Key).
   El plan gratuito alcanza para este proyecto (3.000 correos/mes).

2. **Remitente:**
   - *Rápido para pruebas:* el remitente de pruebas `onboarding@resend.dev` — **pero Resend solo
     permite enviar con este remitente al correo con el que se creó la cuenta de Resend.** Si la
     cuenta de Resend se crea con `aguasclaras713@gmail.com`, se podrá probar el envío del correo
     al administrador, pero **no** llegarán los correos de confirmación/recuperación al huésped de
     prueba (`ing.luisgomez@gmail.com`) hasta verificar un dominio propio.
   - *Recomendado (para poder enviar a cualquier correo, incluidos ambos de prueba):* verificar un
     dominio propio en Resend (Domains → Add Domain) y agregar los registros DNS (SPF/DKIM) que
     indique en el proveedor del dominio. Tarda entre minutos y horas en verificarse.

3. **Configurar el SMTP de Supabase Auth** (esto quita el límite de 2-3 correos/hora):
   Project Settings → Authentication → SMTP Settings → activar "Enable Custom SMTP":
   - Host: `smtp.resend.com` · Puerto: `465`
   - Username: `resend` · Password: la API key de Resend
   - Sender email: el remitente del paso 2 · Sender name: `Sol Estudio Hab`

4. **Desplegar la Edge Function que notifica al administrador** (requiere la
   [CLI de Supabase](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref <ref-del-proyecto>
   supabase functions deploy notificar-pago-admin
   supabase secrets set RESEND_API_KEY=<tu-api-key> CORREO_REMITENTE=<correo-del-paso-2>
   ```

5. En el dashboard de Supabase: **Database → Webhooks → Create a new hook**
   - Tabla: `pagos` · Eventos: `Insert` y `Update` · Tipo: `Supabase Edge Function`
   - Función: `notificar-pago-admin` (la función internamente ignora los cambios que no sean una
     carga de comprobante, no hace falta configurar condiciones).

Sin el webhook del paso 5, los pagos se siguen registrando con normalidad — solo no se envía el
correo automático al administrador. Sin los pasos 1-3, el registro/login de huéspedes sigue
funcionando, solo con el límite de 2-3 correos/hora del servidor compartido de Supabase.

## Contratos (el admin carga, el huésped recibe correo automático)

El admin carga el contrato de cada huésped desde el detalle de huésped (`/admin/huespedes/:id`,
sección "Contratos"); se guarda el historial completo, ningún contrato reemplaza al anterior. El
huésped los ve (solo lectura) en Mi Perfil, sección "Mis contratos".

Al cargarse un contrato, se le avisan **dos correos separados** al huésped (para no mezclar
temas): uno con el contrato adjunto, y otro con el **reglamento de convivencia** — un documento
único para todos, que el admin sube/reemplaza desde el Panel administrador (tarjeta "Reglamento de
convivencia"). Si todavía no se ha subido el reglamento, ese segundo correo simplemente se omite.

El correo del contrato incluye un botón **"Confirmar que leí y acepto"**. Al hacer clic (sin
necesidad de iniciar sesión), el huésped queda registrado como confirmado (`contratos.confirmado_leido`
/ `confirmado_en`) y se les avisa por correo a **todos los administradores** registrados en la
tabla `admins` (incluye `aguasclaras713@gmail.com`). Es idempotente: si el huésped hace clic de
nuevo, no se reenvía el aviso, solo muestra la fecha en que ya había confirmado. El panel admin
(detalle de huésped, sección "Contratos") muestra si cada contrato ya fue confirmado o no.

1. **Desplegar las Edge Functions:**

   ```bash
   supabase functions deploy notificar-contrato-huesped
   supabase functions deploy confirmar-contrato --no-verify-jwt
   ```

   `--no-verify-jwt` es obligatorio en `confirmar-contrato`: es un enlace público que se abre
   directo desde el correo, sin token de sesión de la app. Ninguna necesita secrets nuevos —
   reutilizan `RESEND_API_KEY` y `CORREO_REMITENTE` ya configurados.

2. En el dashboard de Supabase: **Database → Webhooks → Create a new hook**
   - Tabla: `contratos` · Evento: `Insert` · Tipo: `Supabase Edge Function`
   - Función: `notificar-contrato-huesped`

Sin el webhook del paso 2, la carga de contratos sigue funcionando con normalidad (el admin y el
huésped los ven igual en la app) — solo no se envía el correo automático ni el botón de
confirmación.

## Recordatorios, mora y aviso de basura por cron (Fase 4)

Dos Edge Functions programadas con `pg_cron` (zona horaria del servidor: UTC; los horarios de
abajo son 8:00 a.m. en Colombia, `America/Bogota`, UTC-5):

- **[cron-recordatorios-pago](supabase/functions/cron-recordatorios-pago)** — todos los días.
  Por cada mes sin comprobante cargado/verificado: día de pago +2 días → recordatorio; +6 días →
  mora; +10 días → recordatorio adicional **solo por WhatsApp** (si el huésped tiene número
  registrado). Si ya se cumplieron los meses del acuerdo, lo marca `finalizado`, desactiva al
  huésped y envía el aviso de fin de acuerdo.
- **[cron-aviso-basura](supabase/functions/cron-aviso-basura)** — martes, jueves y sábado. Avisa a
  todos los huéspedes activos que hoy es día de sacar la basura.

Cada notificación se envía por **correo**, **push** (si el huésped activó notificaciones en su
perfil), **WhatsApp** (si tiene número registrado y está configurado — ver sección siguiente) y
queda registrada en el centro de notificaciones **dentro de la app** (`/notificaciones`).

### Desplegar

```bash
supabase functions deploy cron-recordatorios-pago
supabase functions deploy cron-aviso-basura
supabase secrets set \
  CRON_SECRET=<una-cadena-aleatoria-larga, p. ej. `openssl rand -hex 32`> \
  VAPID_PUBLIC_KEY=<generada abajo> \
  VAPID_PRIVATE_KEY=<generada abajo> \
  VAPID_SUBJECT=mailto:notificaciones@solestudiohab.com
```

`CRON_SECRET` es un secreto propio (no de un tercero) que solo conoce el llamado del cron —
protege la función para que nadie más pueda invocarla desde afuera.

### Generar las llaves VAPID (para notificaciones push)

```bash
npx web-push generate-vapid-keys
```

La llave **pública** va también en el frontend, como `VITE_VAPID_PUBLIC_KEY` en `.env` (ver
`.env.example`). La llave **privada** solo como secret de las Edge Functions — nunca en el
frontend.

### Programar los cron jobs

Requiere las extensiones `pg_cron` y `pg_net` (la migración 0005 intenta crearlas; si el proyecto
no lo permite por SQL, actívalas manualmente en Database → Extensions). Luego, en el SQL Editor
(reemplazando `<project-ref>`, `<anon-key>` y `<cron-secret>` por los valores reales del proyecto):

```sql
select cron.schedule(
  'recordatorios-pago-diario',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cron-recordatorios-pago',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key>',
      'x-cron-secret', '<cron-secret>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'aviso-basura-mar-jue-sab',
  '0 13 * * 2,4,6', -- martes, jueves, sábado
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cron-aviso-basura',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key>',
      'x-cron-secret', '<cron-secret>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

> El header `Authorization` con la llave anónima es obligatorio: Supabase exige un JWT válido a
> nivel de plataforma antes de que la función reciba la petición, independiente de nuestro propio
> `x-cron-secret`. La llave anónima es pública (la misma de `VITE_SUPABASE_ANON_KEY`), no es un
> secreto.

El archivo [0006_cron_jobs.sql](supabase/migrations/0006_cron_jobs.sql) trae la misma programación
con marcadores — no lo pegues tal cual sin reemplazarlos primero.

## Avisos por WhatsApp (opcional)

Además de correo y push, `cron-aviso-basura` y `cron-recordatorios-pago` (a los +10 días) pueden
avisar por **WhatsApp** a los huéspedes que tengan un número registrado (campo "Número de
WhatsApp", editable por el huésped en Mi Perfil o por el admin en el detalle de huésped). Mientras
no se configuren los secrets de abajo, este canal simplemente no se activa — el resto de la app
sigue funcionando igual.

### Qué se necesita del lado de Meta (no se puede hacer por código, requiere tu propia cuenta)

1. Cuenta de **Meta Business Manager** + una app de **WhatsApp Business Platform** en
   [developers.facebook.com](https://developers.facebook.com/).
2. Un número de teléfono para registrar (una SIM prepago colombiana de Claro, Movistar o Tigo
   sirve — evita WOM, que sí exige recargar cada 30 días). El saldo no vence en esas operadoras,
   así que basta con una recarga inicial.
3. Verificar el negocio en Meta (necesario para levantar los límites de envío).
4. Crear y enviar a aprobación **2 plantillas** (categoría *Utility*, la más barata). Al crear cada
   una, en la sección de **Botones** agrega un botón de tipo **"Visitar sitio web"** (URL estática,
   no dinámica) apuntando a `https://pagos.solestudiohab.com/` — así el huésped tiene un botón
   directo para ir a la app, sin que el código tenga que enviarlo aparte (el botón queda fijo en la
   plantilla ya aprobada):
   - `aviso_basura` — mismo texto que la plantilla de correo (ver
     [cron-aviso-basura/index.ts](supabase/functions/cron-aviso-basura/index.ts)), sin variables.
   - `recordatorio_pago_10dias` — con 3 variables en el cuerpo: `{{1}}` nombre del huésped,
     `{{2}}` número de habitación, `{{3}}` mes en mora. Ejemplo de texto:
     > Hola {{1}}, el pago de la habitación {{2}} correspondiente a {{3}} sigue sin comprobante
     > después de 10 días. Por favor regulariza tu pago o sube el comprobante en la app.
5. Con la app ya verificada, generar un **token de acceso permanente** (System User token) y
   copiar el **Phone Number ID**.

Si cambias los nombres de las plantillas al aprobarlas, actualiza el `template:` correspondiente en
`cron-aviso-basura/index.ts` y `cron-recordatorios-pago/index.ts` antes de desplegar.

### Configurar y desplegar

```bash
supabase secrets set \
  WHATSAPP_TOKEN=<token permanente de Meta> \
  WHATSAPP_PHONE_NUMBER_ID=<phone number id de Meta>
supabase functions deploy cron-aviso-basura
supabase functions deploy cron-recordatorios-pago
```

## Reportes y respaldo (Fase 5)

- **Reportes del administrador** (`/admin/reportes`): resumen de pagados/en revisión/rechazados/
  pendientes/vencidos por mes, avance de cada huésped (meses verificados de los meses del acuerdo)
  y exportación a CSV (se abre bien en Excel).
- **Respaldo de comprobantes**: la Edge Function
  [respaldo-comprobantes](supabase/functions/respaldo-comprobantes) copia los archivos del bucket
  `comprobantes` a un bucket separado `comprobantes-respaldo` (solo lectura para administradores),
  de forma incremental — no vuelve a copiar lo que ya estaba respaldado. Desplegar y programar
  igual que las funciones de la Fase 4:

  ```bash
  supabase functions deploy respaldo-comprobantes
  ```

  ```sql
  select cron.schedule(
    'respaldo-comprobantes-semanal',
    '0 14 * * 0', -- domingo, 9:00 a.m. Bogotá
    $$
    select net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/respaldo-comprobantes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <anon-key>',
        'x-cron-secret', '<cron-secret>'
      ),
      body := '{}'::jsonb
    );
    $$
  );
  ```

- **Respaldo de la base de datos**: esto no se puede automatizar por código, hay que verificarlo en
  el dashboard. En **Database → Backups**, Supabase hace un backup diario automático en los planes
  pagos (Pro en adelante), con una retención configurable; en el plan gratuito **no hay backups
  automáticos** ni point-in-time recovery. Antes de operar con huéspedes reales, definir:
  - Si el proyecto pasará a un plan pago (recomendado) para tener backups diarios, o
  - Un respaldo manual periódico con `supabase db dump --linked` guardado fuera de Supabase.

## Pruebas (Fase 6)

Ver también [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md) (matriz de casos por historia de usuario) y
[CHECKLIST-DISPOSITIVOS.md](CHECKLIST-DISPOSITIVOS.md) (pruebas manuales en Android/navegadores).

### Unitarias

```bash
npm test              # corre una vez
npm run test:watch    # modo watch
npm run test:coverage # con reporte de cobertura
```

Cubren la lógica de negocio pura en `src/lib/` (calendario de pagos, cálculo de estado por mes,
validación de archivos) — 100% de cobertura en esos módulos. No cubren `push.ts`/`supabase.ts`/
`csv.ts` (envoltorios delgados de APIs del navegador/Supabase, ya ejercitados por las pruebas E2E
y manuales).

### Seguridad (RLS) — contra el proyecto real

```bash
npm run test:seguridad
```

Requiere las cuentas de prueba reales en `.env` (`HUESPED_PRUEBA_EMAIL/PASSWORD`,
`ADMIN_PRUEBA_EMAIL/PASSWORD`) — si faltan, la suite se omite en vez de fallar. Verifica que un
cliente sin sesión y un huésped no puedan leer datos ajenos, escalar a administrador, ni marcar su
propio pago como verificado. Ver [tests/seguridad.test.ts](tests/seguridad.test.ts).

### End-to-end (Playwright) — contra la app real corriendo en local

```bash
npx playwright install chromium  # una sola vez
npm run test:e2e
```

Requiere `npm run dev` corriendo (o lo levanta solo) y las mismas cuentas de prueba del punto
anterior. Cubre: rutas protegidas, validaciones del formulario de registro, calendario y carga de
comprobantes, panel admin (verificar pago) y reportes.

> **Dato de las pruebas de carga de comprobantes:** como corren contra el proyecto Supabase real
> (no hay una base de datos de prueba desechable por corrida), buscan dinámicamente un mes del
> acuerdo de la cuenta de huésped de prueba que todavía no tenga comprobante. El acuerdo de prueba
> tiene un número fijo de meses — después de suficientes corridas, todos quedan verificados y esa
> prueba empieza a omitirse (no falla) hasta que se le dé un nuevo acuerdo a la cuenta de prueba
> (fecha de ingreso más reciente o más meses) desde el panel admin.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verificación de tipos + build de producción (genera la PWA) |
| `npm run preview` | Servir el build de producción localmente |
| `npm run lint` | Linter (oxlint) |
| `npm test` / `test:watch` / `test:coverage` | Pruebas unitarias (Vitest) |
| `npm run test:seguridad` | Pruebas de RLS contra el proyecto real |
| `npm run test:e2e` | Pruebas end-to-end (Playwright) |

## Estructura

```
src/
  components/   Layout y componentes compartidos
  pages/        Pantallas (Inicio, Ingresar, Registro, …)
  lib/          Cliente de Supabase y utilidades
  sw.ts         Service worker (notificaciones push)
supabase/
  migrations/   Esquema de BD versionado (tablas, RLS, Storage)
  functions/    Edge Functions (correo al admin, crons, respaldo)
public/
  icons/        Íconos de la PWA (instalación en Android)
```

## Seguridad

- Base de datos única con **Row Level Security**: cada huésped solo accede a su
  propia información; el rol administrador se gestiona en la tabla `admins`.
- Comprobantes en bucket **privado** (`comprobantes/{huesped_id}/AAAA-MM.ext`),
  accesibles solo con URL firmada temporal.
- Sin secretos en el frontend: solo la URL y la llave anónima pública de Supabase.
