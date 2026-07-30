-- =============================================================
-- Sol Estudio Hab — Migración 0010: número de WhatsApp del huésped
-- Prepara el modelo de datos para enviar avisos por WhatsApp (Cloud
-- API de Meta) además de correo y push. El envío real depende de
-- configurar las credenciales de Meta y aprobar las plantillas (ver
-- README) — esta migración solo deja la base de datos lista.
-- =============================================================

alter table public.huespedes
  add column numero_whatsapp text;

-- Canal nuevo para las notificaciones existentes (aviso_basura, etc.)
alter type canal_notificacion add value if not exists 'whatsapp';

-- Tipo nuevo: recordatorio de pago a los 10 días, exclusivo de WhatsApp
-- (adicional a 'recordatorio' a +2 días y 'mora' a +6 días, que siguen
-- yendo por correo/push sin cambios).
alter type tipo_notificacion add value if not exists 'mora_whatsapp';

-- Recoge el numero_whatsapp opcional del registro, si viene en los
-- metadatos (options.data del signUp). Es opcional a propósito: no debe
-- impedir el alta si el huésped no lo diligencia.
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
    insert into public.huespedes (id, correo, nombres, numero_habitacion, numero_whatsapp)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'nombres',
      new.raw_user_meta_data ->> 'numero_habitacion',
      new.raw_user_meta_data ->> 'numero_whatsapp'
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
