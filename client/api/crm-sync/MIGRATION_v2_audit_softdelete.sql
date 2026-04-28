-- ============================================================
-- Migración v2: soft-delete (15 días) + auditoría created/updated_by_email
-- Para el Supabase de la app de Finanzas (Soul IA).
-- Ejecutar en: Supabase → SQL Editor → Run.
-- Idempotente: se puede ejecutar varias veces sin romper nada.
-- ============================================================

-- 1. Añade columnas a las 7 tablas usadas por el CRM
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['movements','accounts','categories','recurring_rules','debts','savings_goals','investments'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by_email TEXT', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by_email TEXT', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON %I(deleted_at) WHERE deleted_at IS NOT NULL', t, t);
  END LOOP;
END $$;

-- 2. Purga automática: borra definitivamente filas con deleted_at > 15 días
CREATE OR REPLACE FUNCTION purge_soft_deleted_finance() RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['movements','accounts','categories','recurring_rules','debts','savings_goals','investments'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DELETE FROM %I WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL ''15 days''', t);
  END LOOP;
END $$;

-- Ejecuta la purga una vez ahora (no debería borrar nada la primera vez)
SELECT purge_soft_deleted_finance();

-- ============================================================
-- LISTO. Los endpoints filtrarán por deleted_at IS NULL al listar,
-- y DELETE hará UPDATE deleted_at = NOW() en vez de borrar.
-- Para purgar manualmente en el futuro: SELECT purge_soft_deleted_finance();
-- ============================================================
