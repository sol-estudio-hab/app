-- =============================================================
-- Sol Estudio Hab — Migración 0006: programación de los cron jobs
-- (Fase 4: recordatorios/mora/fin de acuerdo + aviso de basura)
--
-- *** ANTES DE EJECUTAR *** reemplaza los tres marcadores de abajo:
--   <project-ref>  → Project Settings → General → Reference ID
--                    (en este proyecto: udnnvvcexvjtzwcgetke).
--   <anon-key>     → la misma llave pública de VITE_SUPABASE_ANON_KEY.
--                    Supabase exige un JWT válido a nivel de plataforma
--                    para invocar cualquier Edge Function, además de
--                    nuestro propio x-cron-secret.
--   <cron-secret>  → una cadena aleatoria larga que tú inventes (p. ej.
--                    con `openssl rand -hex 32`). Debe ser EXACTAMENTE
--                    la misma que el secret CRON_SECRET de las
--                    Edge Functions.
--
-- Los horarios están en UTC porque pg_cron corre en la zona horaria del
-- servidor. 13:00 UTC = 8:00 a.m. en Colombia (America/Bogota, UTC-5).
-- Ajusta la hora si tu horario preferido es otro.
-- =============================================================

-- Recordatorios/mora/fin de acuerdo: todos los días a las 8:00 a.m. (Bogotá)
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

-- Aviso de sacar la basura: martes, jueves y sábado a las 8:00 a.m. (Bogotá)
-- (día de la semana en cron: 0/7=domingo, 1=lunes, 2=martes, 3=miércoles,
--  4=jueves, 5=viernes, 6=sábado)
select cron.schedule(
  'aviso-basura-mar-jue-sab',
  '0 13 * * 2,4,6',
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
