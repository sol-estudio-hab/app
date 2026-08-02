-- =============================================================
-- Sol Estudio Hab — Migración 0012: habitación única por acuerdo activo
-- Evita que dos acuerdos activos (de huéspedes distintos) queden
-- asignados a la misma habitación, y expone qué habitaciones están
-- ocupadas para que el propio huésped pueda elegir una libre al crear
-- un acuerdo nuevo (autoservicio, sin pasar por el administrador).
-- =============================================================

create or replace function public.validar_habitacion_unica_activa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  habitacion_nueva text;
  conflicto uuid;
begin
  if new.estado <> 'activo' then
    return new;
  end if;

  select numero_habitacion into habitacion_nueva
  from public.huespedes
  where id = new.huesped_id;

  select a.id into conflicto
  from public.acuerdos a
  join public.huespedes h on h.id = a.huesped_id
  where a.estado = 'activo'
    and a.id <> new.id
    and h.numero_habitacion = habitacion_nueva
  limit 1;

  if conflicto is not null then
    raise exception 'Ya existe un acuerdo activo para la habitación %', habitacion_nueva;
  end if;

  return new;
end;
$$;

create trigger acuerdos_validar_habitacion
  before insert or update on public.acuerdos
  for each row execute function public.validar_habitacion_unica_activa();

-- Habitaciones con acuerdo activo en este momento, sin exponer datos de otros
-- huéspedes (un huésped normal no puede leer las filas de otros por RLS).
create or replace function public.habitaciones_ocupadas()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct h.numero_habitacion
  from public.acuerdos a
  join public.huespedes h on h.id = a.huesped_id
  where a.estado = 'activo';
$$;
