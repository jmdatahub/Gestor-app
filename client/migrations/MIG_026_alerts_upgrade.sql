-- MIG_026: Alerts upgrade - severity, snooze, action routing
-- Run this in Supabase SQL Editor

-- 1. Add severity to alerts (info / warning / danger)
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'danger'));

-- 2. Add snooze support
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL;

-- 3. Add optional deep-link for quick navigation from alert
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS action_url TEXT NULL;

-- 4. Index for efficient snoozed alert filtering
CREATE INDEX IF NOT EXISTS idx_alerts_snoozed_until
  ON alerts (user_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- 5. Index for severity-based sorting/filtering
CREATE INDEX IF NOT EXISTS idx_alerts_severity
  ON alerts (user_id, severity, is_read);

-- 6. Backfill severity on existing rows based on type
UPDATE alerts SET severity = CASE
  WHEN type = 'debt_due'           THEN 'danger'
  WHEN type = 'spending_limit'     THEN 'warning'
  WHEN type = 'investment_drop'    THEN 'warning'
  WHEN type = 'rule_pending'       THEN 'info'
  WHEN type = 'savings_goal_progress' THEN 'info'
  ELSE 'info'
END
WHERE severity = 'info';  -- only touch rows that still have default

-- Verify
SELECT type, severity, COUNT(*) FROM alerts GROUP BY type, severity ORDER BY type;
