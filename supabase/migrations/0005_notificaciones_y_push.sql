-- =============================================================
-- Sol Estudio Hab — Migración 0005: soporte para Fase 4
-- (recordatorios/mora/fin de acuerdo y aviso de sacar la basura)
-- =============================================================

-- Nuevo tipo de notificación para el aviso de sacar la basura.
-- (ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción
-- en la que luego se lee ese valor, pero aquí solo lo agregamos.)
alter type tipo_notificacion add value if not exists 'aviso_basura';

-- La idempotencia de notificaciones (T4.1.4) depende de mes_referencia,
-- pero el aviso de basura no referencia un mes (siempre es NULL) y en
-- SQL estándar NULL <> NULL, así que dos avisos el mismo día no violarían
-- el índice único. "NULLS NOT DISTINCT" corrige esto tratando los NULL
-- como iguales entre sí para el propósito de la restricción de unicidad.
--
-- El índice también necesita "el día de enviado_en" como parte de la
-- clave. `enviado_en::date` depende del timezone de la sesión (no es
-- IMMUTABLE), por lo que Postgres rechaza usarlo directamente en un
-- índice — de hecho la versión original de este índice en la migración
-- 0001 nunca llegó a crearse por este mismo motivo. Se resuelve con una
-- función envoltorio que fija el timezone a UTC (sí es determinista).
create or replace function public.fecha_utc(marca timestamptz)
returns date
language sql
immutable
as $$
  select (marca at time zone 'UTC')::date;
$$;

drop index if exists notificaciones_idempotencia;
create unique index notificaciones_idempotencia
  on public.notificaciones (huesped_id, tipo, canal, mes_referencia, public.fecha_utc(enviado_en))
  nulls not distinct;

-- ---------- Suscripciones de notificaciones push (Web Push) ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  huesped_id uuid not null references public.huespedes (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Cada huésped administra únicamente sus propias suscripciones.
create policy push_subscriptions_select on public.push_subscriptions
  for select using (huesped_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (huesped_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions
  for update using (huesped_id = auth.uid()) with check (huesped_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (huesped_id = auth.uid());

-- ---------- Extensiones necesarias para los cron jobs ----------
-- Si el proyecto no permite crear estas extensiones por SQL, actívalas
-- manualmente desde Database → Extensions (pg_cron y pg_net) y omite
-- estas dos líneas.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
