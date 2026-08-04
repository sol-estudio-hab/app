-- =============================================================
-- Sol Estudio Hab — Migración 0013: valor real del depósito
-- Campo manual para que el admin registre el valor real del depósito,
-- ya que el comprobante cargado en esa sección a veces corresponde a un
-- pago mixto (arriendo + depósito) y no refleja el valor exacto del
-- depósito. Solo lo edita el admin (misma RLS de acuerdos_update_admin).
-- =============================================================

alter table public.acuerdos
  add column deposito_valor integer;
