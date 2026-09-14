-- =============================================================
-- Sol Estudio Hab — Migración 0015: cron del resumen de mora al admin
--
-- *** ANTES DE EJECUTAR *** reemplaza los tres marcadores (igual que en
-- la migración 0006):
--   <project-ref>  → udnnvvcexvjtzwcgetke
--   <anon-key>     → VITE_SUPABASE_ANON_KEY (.env)
--   <cron-secret>  → el mismo CRON_SECRET ya configurado en los secrets
--                    de las Edge Functions (el de cron-recordatorios-pago).
--
-- "*/2" en el campo de día del mes es la forma estándar de aproximar
-- "cada 2 días" con cron; puede generar un salto de 1 día justo al
-- cruzar de un mes a otro (irrelevante para un reporte de control).
-- =============================================================

select cron.schedule(
  'resumen-mora-admin-cada-2-dias',
  '0 13 */2 * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cron-resumen-mora-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <anon-key>',
      'x-cron-secret', '<cron-secret>'
    ),
    body := '{}'::jsonb
  );
  $$
);
