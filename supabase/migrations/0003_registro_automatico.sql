-- =============================================================
-- Sol Estudio Hab — Migración 0003: alta automática de huésped
-- Crea la fila en huespedes + el acuerdo inicial al registrarse
-- en Supabase Auth. Los datos del formulario de registro viajan
-- en raw_user_meta_data (options.data del signUp en el cliente).
-- SECURITY DEFINER: el trigger corre como dueño de las tablas,
-- por lo que no lo bloquea RLS ni depende de que el correo ya
-- esté confirmado.
-- =============================================================

create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.manejar_nuevo_usuario();
