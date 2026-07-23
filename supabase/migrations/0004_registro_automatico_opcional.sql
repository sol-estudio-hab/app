-- =============================================================
-- Sol Estudio Hab — Migración 0004: corrige el alta automática
-- de huésped para que no rompa la creación de usuarios que no
-- vienen del formulario de /registro (p. ej. administradores
-- creados manualmente desde el Dashboard de Supabase).
--
-- El trigger de la migración 0003 asumía que TODO usuario nuevo
-- traía nombres/numero_habitacion/fecha_ingreso/meses_acuerdo en
-- los metadatos, e insertaba NULL en columnas obligatorias cuando
-- no era así, haciendo fallar la creación del usuario completo.
-- Ahora solo crea el huésped + acuerdo si esos 4 campos están
-- presentes en los metadatos.
-- =============================================================

create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'nombres'
     and new.raw_user_meta_data ? 'numero_habitacion'
     and new.raw_user_meta_data ? 'fecha_ingreso'
     and new.raw_user_meta_data ? 'meses_acuerdo'
  then
    insert into public.huespedes (id, correo, nombres, numero_habitacion)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'nombres',
      new.raw_user_meta_data ->> 'numero_habitacion'
    );

    insert into public.acuerdos (huesped_id, fecha_ingreso, meses_acuerdo)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'fecha_ingreso')::date,
      (new.raw_user_meta_data ->> 'meses_acuerdo')::integer
    );
  end if;

  return new;
end;
$$;
