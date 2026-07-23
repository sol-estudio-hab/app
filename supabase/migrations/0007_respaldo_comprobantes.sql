-- =============================================================
-- Sol Estudio Hab — Migración 0007: bucket de respaldo de comprobantes
-- (Fase 5, T5.2.2). La Edge Function respaldo-comprobantes copia
-- periódicamente los archivos del bucket `comprobantes` a este bucket
-- separado, como resguardo ante un borrado o corrupción accidental del
-- bucket principal.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-respaldo',
  'comprobantes-respaldo',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Solo administradores pueden leer el respaldo (recuperación ante
-- desastres). Las escrituras las hace únicamente la Edge Function de
-- respaldo con el service role, que no depende de estas políticas.
create policy comprobantes_respaldo_leer on storage.objects
  for select using (
    bucket_id = 'comprobantes-respaldo'
    and public.es_admin()
  );
