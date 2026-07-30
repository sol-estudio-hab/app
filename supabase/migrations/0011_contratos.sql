-- =============================================================
-- Sol Estudio Hab — Migración 0011: contratos de arriendo
-- El admin carga el contrato firmado de cada huésped (se conserva el
-- historial completo: cada carga es un contrato nuevo, ninguno se
-- reemplaza). Al cargarse, se le avisa por correo al huésped con el
-- contrato adjunto, y en un correo aparte el reglamento de convivencia
-- (documento fijo, el mismo para todos, en
-- contratos/reglamento/reglamento-convivencia.pdf).
-- =============================================================

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  huesped_id uuid not null references public.huespedes (id) on delete cascade,
  archivo_url text not null,
  nombre_archivo text not null,
  subido_por uuid not null references public.admins (id),
  creado_en timestamptz not null default now()
);

alter table public.contratos enable row level security;

-- contratos: el huésped solo ve los suyos; solo el admin carga/borra
create policy contratos_select on public.contratos
  for select using (huesped_id = auth.uid() or public.es_admin());
create policy contratos_insert on public.contratos
  for insert with check (public.es_admin());
create policy contratos_delete on public.contratos
  for delete using (public.es_admin());

-- ---------- Bucket de almacenamiento ----------
-- Ruta: {huesped_id}/{contrato_id}.{ext}
-- El reglamento fijo vive aparte, en reglamento/reglamento-convivencia.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contratos',
  'contratos',
  false,
  10485760, -- 10 MB máximo por archivo (contratos de 4-5 MB con margen)
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Solo el admin sube contratos (a la carpeta del huésped) y el reglamento
-- (a la carpeta "reglamento").
create policy contratos_subir on storage.objects
  for insert with check (
    bucket_id = 'contratos' and public.es_admin()
  );

create policy contratos_reemplazar on storage.objects
  for update using (
    bucket_id = 'contratos' and public.es_admin()
  );

create policy contratos_borrar on storage.objects
  for delete using (
    bucket_id = 'contratos' and public.es_admin()
  );

-- Cada huésped lee solo su propia carpeta; el admin lee todo (incluido
-- el reglamento fijo, que la Edge Function lee con el service role).
create policy contratos_leer on storage.objects
  for select using (
    bucket_id = 'contratos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.es_admin()
    )
  );
