-- =============================================================
-- Sol Estudio Hab — Migración 0014: confirmación de lectura de contrato
-- El correo del contrato incluye un enlace "Confirmar que leí y acepto".
-- Al hacer clic, la Edge Function `confirmar-contrato` (pública, sin
-- verify_jwt) registra la confirmación y avisa al administrador.
-- =============================================================

alter table public.contratos
  add column confirmado_leido boolean not null default false,
  add column confirmado_en timestamptz;
