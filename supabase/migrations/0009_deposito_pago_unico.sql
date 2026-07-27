-- =============================================================
-- Sol Estudio Hab — Migración 0009: depósito pagado en un solo cargue
-- Permite al administrador marcar que el depósito ya se completó con el
-- primer cargue, para que el segundo no se muestre y genere confusión.
-- Solo el admin puede modificarlo (misma RLS de acuerdos_update_admin).
-- =============================================================

alter table public.acuerdos
  add column deposito_pago_unico boolean not null default false;
