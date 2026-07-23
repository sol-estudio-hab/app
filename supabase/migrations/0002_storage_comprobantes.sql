-- =============================================================
-- Sol Estudio Hab — Migración 0002: bucket privado de comprobantes
-- Ruta de archivos: comprobantes/{huesped_id}/{YYYY-MM}.{ext}
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,                                   -- bucket PRIVADO: solo URLs firmadas
  10485760,                                -- 10 MB máximo por archivo
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Cada huésped solo puede subir/leer dentro de su propia carpeta ({huesped_id}/...)
create policy comprobantes_subir on storage.objects
  for insert with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy comprobantes_leer on storage.objects
  for select using (
    bucket_id = 'comprobantes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.es_admin()
    )
  );

create policy comprobantes_reemplazar on storage.objects
  for update using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
