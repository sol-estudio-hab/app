-- =============================================================
-- Sol Estudio Hab — Migración 0001: esquema inicial + RLS
-- Modelo definido en PLAN-DE-TRABAJO.md (sección 2)
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type estado_pago as enum ('pendiente', 'cargado', 'verificado', 'rechazado');
create type estado_acuerdo as enum ('activo', 'finalizado');
create type tipo_notificacion as enum ('recordatorio', 'mora', 'confirmacion', 'fin_acuerdo');
create type canal_notificacion as enum ('correo', 'push', 'app');

-- ---------- Tablas ----------
create table public.huespedes (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null unique,
  nombres text not null,
  numero_habitacion text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null unique,
  nombres text not null
);

create table public.acuerdos (
  id uuid primary key default gen_random_uuid(),
  huesped_id uuid not null references public.huespedes (id) on delete cascade,
  -- fecha del acuerdo firmado = fecha de ingreso; define el día de pago mensual
  fecha_ingreso date not null,
  meses_acuerdo integer not null check (meses_acuerdo > 0),
  estado estado_acuerdo not null default 'activo',
  creado_en timestamptz not null default now()
);

-- Un huésped solo puede tener un acuerdo activo a la vez
create unique index acuerdos_activo_unico
  on public.acuerdos (huesped_id)
  where estado = 'activo';

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  acuerdo_id uuid not null references public.acuerdos (id) on delete cascade,
  mes_pagado char(7) not null check (mes_pagado ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  archivo_url text,
  estado estado_pago not null default 'pendiente',
  fecha_carga timestamptz,
  verificado_por uuid references public.admins (id),
  fecha_verificacion timestamptz,
  observaciones text,
  unique (acuerdo_id, mes_pagado)
);

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  huesped_id uuid not null references public.huespedes (id) on delete cascade,
  tipo tipo_notificacion not null,
  canal canal_notificacion not null,
  mes_referencia char(7),
  enviado_en timestamptz not null default now(),
  leido boolean not null default false
);

-- Evita duplicar la misma notificación el mismo día (idempotencia del cron)
create unique index notificaciones_idempotencia
  on public.notificaciones (huesped_id, tipo, canal, mes_referencia, (enviado_en::date));

create table public.auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid,
  accion text not null,
  entidad text not null,
  detalle jsonb,
  fecha timestamptz not null default now()
);

-- ---------- Funciones auxiliares ----------
-- ¿El usuario autenticado es administrador?
create or replace function public.es_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

-- Mantener actualizado_en al día
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger huespedes_tocar
  before update on public.huespedes
  for each row execute function public.tocar_actualizado_en();

-- ---------- Row Level Security ----------
alter table public.huespedes enable row level security;
alter table public.admins enable row level security;
alter table public.acuerdos enable row level security;
alter table public.pagos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.auditoria enable row level security;

-- huespedes: cada uno ve y edita solo su fila; el admin ve todo
create policy huespedes_select on public.huespedes
  for select using (id = auth.uid() or public.es_admin());
create policy huespedes_insert on public.huespedes
  for insert with check (id = auth.uid());
create policy huespedes_update_propio on public.huespedes
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy huespedes_update_admin on public.huespedes
  for update using (public.es_admin());

-- admins: solo visible para administradores (las altas se hacen por SQL/consola)
create policy admins_select on public.admins
  for select using (public.es_admin());

-- acuerdos: el huésped ve y crea los suyos; solo el admin los modifica
create policy acuerdos_select on public.acuerdos
  for select using (huesped_id = auth.uid() or public.es_admin());
create policy acuerdos_insert on public.acuerdos
  for insert with check (huesped_id = auth.uid() or public.es_admin());
create policy acuerdos_update_admin on public.acuerdos
  for update using (public.es_admin());

-- pagos: el huésped ve/carga los de su acuerdo; el admin verifica
create policy pagos_select on public.pagos
  for select using (
    exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
    or public.es_admin()
  );
create policy pagos_insert on public.pagos
  for insert with check (
    exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );
create policy pagos_update_propio on public.pagos
  for update using (
    estado in ('pendiente', 'cargado', 'rechazado')
    and exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );
create policy pagos_update_admin on public.pagos
  for update using (public.es_admin());

-- notificaciones: el huésped ve las suyas y marca leído; escribe el backend (service role)
create policy notificaciones_select on public.notificaciones
  for select using (huesped_id = auth.uid() or public.es_admin());
create policy notificaciones_update_leido on public.notificaciones
  for update using (huesped_id = auth.uid()) with check (huesped_id = auth.uid());

-- auditoria: solo lectura para administradores; escribe el backend (service role)
create policy auditoria_select on public.auditoria
  for select using (public.es_admin());
