-- =============================================================
-- Sol Estudio Hab — Migración 0017: archivar huéspedes
-- Para un huésped que se retiró antes de tiempo: se finaliza su acuerdo
-- activo (la habitación queda libre), se desactiva la cuenta y se marca
-- como archivado. Se conserva todo el historial. Un huésped archivado no
-- recibe correos, push ni WhatsApp (los cron solo consideran acuerdos
-- activos) y no puede volver a crear un acuerdo por su cuenta.
-- =============================================================

alter table public.huespedes
  add column archivado boolean not null default false,
  add column archivado_en timestamptz;

-- Solo un administrador puede archivar o restaurar (el huésped puede editar
-- su propia fila, pero no estos campos). auth.uid() nulo = service role / SQL.
create or replace function public.proteger_archivado_huesped()
returns trigger
language plpgsql
as $$
begin
  if (new.archivado is distinct from old.archivado
      or new.archivado_en is distinct from old.archivado_en)
     and auth.uid() is not null
     and not public.es_admin()
  then
    raise exception 'Solo un administrador puede archivar o restaurar huéspedes.';
  end if;
  return new;
end;
$$;

create trigger huespedes_proteger_archivado
  before update on public.huespedes
  for each row execute function public.proteger_archivado_huesped();

-- Un huésped archivado no puede crearse un acuerdo nuevo por autoservicio.
drop policy if exists acuerdos_insert on public.acuerdos;
create policy acuerdos_insert on public.acuerdos
  for insert with check (
    public.es_admin()
    or (
      huesped_id = auth.uid()
      and not exists (
        select 1 from public.huespedes h
        where h.id = auth.uid() and h.archivado
      )
    )
  );

-- Archiva en una sola transacción: finaliza el acuerdo activo (libera la
-- habitación), desactiva la cuenta y la marca como archivada.
create or replace function public.archivar_huesped(p_huesped_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  update public.acuerdos
  set estado = 'finalizado'
  where huesped_id = p_huesped_id and estado = 'activo';

  update public.huespedes
  set activo = false, archivado = true, archivado_en = now()
  where id = p_huesped_id;
end;
$$;

-- Restaura: lo saca del archivo. No lo reactiva ni le crea acuerdo; eso se
-- hace después con "Corregir y reactivar" / "Crear nuevo acuerdo".
create or replace function public.restaurar_huesped(p_huesped_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  update public.huespedes
  set archivado = false, archivado_en = null
  where id = p_huesped_id;
end;
$$;

revoke execute on function public.archivar_huesped(uuid) from public, anon;
revoke execute on function public.restaurar_huesped(uuid) from public, anon;
grant execute on function public.archivar_huesped(uuid) to authenticated;
grant execute on function public.restaurar_huesped(uuid) to authenticated;
