-- =============================================================
-- Sol Estudio Hab — Migración 0016: gestión de comprobantes
--
-- 1) El huésped puede ELIMINAR su comprobante (mensual o de depósito)
--    mientras no esté verificado, para corregir un cargue equivocado.
-- 2) El administrador puede cargar (p. ej. pagos en efectivo), eliminar y
--    mover de mes comprobantes de cualquier huésped, en cualquier estado.
-- Aplica a las tablas pagos y depositos y al bucket "comprobantes".
-- =============================================================

-- ---------- Cierre de hueco: el huésped no puede crear un pago ya "verificado" ----------
-- (antes la política solo comprobaba que el acuerdo fuera suyo, así que podía
-- insertar directamente una fila con estado 'verificado' por la API).
drop policy if exists pagos_insert on public.pagos;
create policy pagos_insert on public.pagos
  for insert with check (
    estado in ('pendiente', 'cargado')
    and exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );

drop policy if exists depositos_insert on public.depositos;
create policy depositos_insert on public.depositos
  for insert with check (
    estado in ('pendiente', 'cargado')
    and exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );

-- ---------- pagos ----------
create policy pagos_insert_admin on public.pagos
  for insert with check (public.es_admin());

create policy pagos_delete_admin on public.pagos
  for delete using (public.es_admin());

create policy pagos_delete_propio on public.pagos
  for delete using (
    estado in ('pendiente', 'cargado', 'rechazado')
    and exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );

-- ---------- depositos ----------
create policy depositos_insert_admin on public.depositos
  for insert with check (public.es_admin());

create policy depositos_delete_admin on public.depositos
  for delete using (public.es_admin());

create policy depositos_delete_propio on public.depositos
  for delete using (
    estado in ('pendiente', 'cargado', 'rechazado')
    and exists (
      select 1 from public.acuerdos a
      where a.id = acuerdo_id and a.huesped_id = auth.uid()
    )
  );

-- ---------- Storage: bucket "comprobantes" ----------
-- ¿El archivo ya está asociado a un pago/depósito verificado? Los huéspedes
-- no pueden borrarlo ni sobrescribirlo (security definer para que la
-- comprobación no dependa de lo que el huésped pueda ver por RLS).
create or replace function public.comprobante_verificado(ruta text)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (select 1 from pagos where archivo_url = ruta and estado = 'verificado')
      or exists (select 1 from depositos where archivo_url = ruta and estado = 'verificado');
$$;

-- El huésped solo reemplaza archivos suyos que aún no están verificados
-- (antes podía sobrescribir incluso uno ya verificado).
drop policy if exists comprobantes_reemplazar on storage.objects;
create policy comprobantes_reemplazar on storage.objects
  for update using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.comprobante_verificado(name)
  );

create policy comprobantes_borrar_propio on storage.objects
  for delete using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.comprobante_verificado(name)
  );

-- El administrador gestiona cualquier archivo (subir en nombre del huésped,
-- reemplazar, mover de mes = actualizar el nombre, y borrar).
create policy comprobantes_admin_subir on storage.objects
  for insert with check (bucket_id = 'comprobantes' and public.es_admin());

create policy comprobantes_admin_reemplazar on storage.objects
  for update using (bucket_id = 'comprobantes' and public.es_admin())
  with check (bucket_id = 'comprobantes' and public.es_admin());

create policy comprobantes_admin_borrar on storage.objects
  for delete using (bucket_id = 'comprobantes' and public.es_admin());
