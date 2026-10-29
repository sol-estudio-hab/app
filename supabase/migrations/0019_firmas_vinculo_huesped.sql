-- =============================================================
-- Sol Estudio Hab — Migración 0019: firmas completadas ↔ contrato del huésped
--
-- Cuando un contrato de firma queda con todas las firmas, se VINCULA (no se copia)
-- a la sección "Contratos" del huésped: la fila de `contratos` apunta al mismo PDF
-- que vive en el bucket `firmas`. Además se puede enviar la copia firmada por correo.
-- =============================================================

alter table public.firma_contratos
  add column huesped_id uuid references public.huespedes (id) on delete set null,
  add column correo_enviado_en timestamptz;

-- `bucket` indica dónde vive el archivo (los contratos subidos a mano siguen en
-- "contratos"; los firmados digitalmente apuntan al bucket "firmas").
-- Si se elimina el contrato de firma, desaparece también su vínculo.
alter table public.contratos
  add column bucket text not null default 'contratos',
  add column firma_contrato_id uuid references public.firma_contratos (id) on delete cascade;

create unique index contratos_firma_unico
  on public.contratos (firma_contrato_id)
  where firma_contrato_id is not null;

-- El huésped puede leer (solo lectura) el PDF firmado que está vinculado a SU contrato.
create policy firmas_huesped_leer on storage.objects
  for select using (
    bucket_id = 'firmas'
    and exists (
      select 1 from public.contratos c
      where c.huesped_id = auth.uid()
        and c.bucket = 'firmas'
        and c.archivo_url = name
    )
  );
