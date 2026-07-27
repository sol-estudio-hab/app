-- =============================================================
-- Sol Estudio Hab — Migración 0008: depósito de garantía
-- Hasta 2 cargues por acuerdo (no depende del mes, es global).
-- Reutiliza el bucket "comprobantes" con ruta {huesped_id}/deposito-{numero_cargue}.{ext}
-- =============================================================

create table public.depositos (
  id uuid primary key default gen_random_uuid(),
  acuerdo_id uuid not null references public.acuerdos (id) on delete cascade,
  numero_cargue smallint not null check (numero_cargue in (1, 2)),
  archivo_url text,
  estado estado_pago not null default 'pendiente',
  fecha_carga timestamptz,
  verificado_por uuid references public.admins (id),
  fecha_verificacion timestamptz,
  observaciones text,
  unique (acuerdo_id, numero_cargue)
);

alter table public.depositos enable row level security;

-- depositos: el huésped ve/carga los de su acuerdo; el admin verifica (igual que pagos)
create policy depositos_select on public.depositos
  for select using (
    exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
    or public.es_admin()
  );

create policy depositos_insert on public.depositos
  for insert with check (
    exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );

create policy depositos_update_propio on public.depositos
  for update using (
    estado in ('pendiente', 'cargado', 'rechazado')
    and exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );

create policy depositos_update_admin on public.depositos
  for update using (public.es_admin());
