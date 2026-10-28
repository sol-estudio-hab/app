-- =============================================================
-- Sol Estudio Hab — Migración 0018: firma de PDFs por enlace
--
-- El administrador sube un PDF, define firmantes y casillas de firma, y cada
-- firmante lo firma desde el celular con su propio enlace (token). Las firmas
-- se estampan en el SERVIDOR (Edge Functions firma-sesion / firma-enviar,
-- que usan el service role). El navegador de un firmante nunca lee ni
-- escribe estas tablas: solo el administrador (RLS).
-- =============================================================

create table public.firma_contratos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  habitacion text,
  -- Rutas en el bucket "firmas": original/{id}.pdf y firmados/{id}/v{n}.pdf
  ruta_original text not null,
  ruta_firmado text,
  -- Control de concurrencia: dos firmantes simultáneos no se pisan.
  version integer not null default 0,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'parcial', 'completado')),
  creado_por uuid references public.admins (id),
  creado_en timestamptz not null default now()
);

create table public.firma_firmantes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.firma_contratos (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  nombre text not null,
  rol text not null,
  correo text,
  telefono text,
  firmado_en timestamptz,
  ip text
);

create index firma_firmantes_contrato on public.firma_firmantes (contrato_id);

-- Coordenadas en puntos PDF (1 pt = 1/72 pulgada), origen abajo-izquierda.
create table public.firma_campos (
  id uuid primary key default gen_random_uuid(),
  firmante_id uuid not null references public.firma_firmantes (id) on delete cascade,
  pagina integer not null check (pagina >= 1),
  x numeric not null,
  y numeric not null,
  ancho numeric not null check (ancho > 0),
  alto numeric not null check (alto > 0)
);

create index firma_campos_firmante on public.firma_campos (firmante_id);

alter table public.firma_contratos enable row level security;
alter table public.firma_firmantes enable row level security;
alter table public.firma_campos enable row level security;

-- Solo administradores (cualquier operación). Los firmantes acceden por
-- Edge Functions con el service role, que no depende de estas políticas.
create policy firma_contratos_admin on public.firma_contratos
  for all using (public.es_admin()) with check (public.es_admin());
create policy firma_firmantes_admin on public.firma_firmantes
  for all using (public.es_admin()) with check (public.es_admin());
create policy firma_campos_admin on public.firma_campos
  for all using (public.es_admin()) with check (public.es_admin());

-- ---------- Bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firmas', 'firmas', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy firmas_admin_subir on storage.objects
  for insert with check (bucket_id = 'firmas' and public.es_admin());
create policy firmas_admin_leer on storage.objects
  for select using (bucket_id = 'firmas' and public.es_admin());
create policy firmas_admin_borrar on storage.objects
  for delete using (bucket_id = 'firmas' and public.es_admin());
