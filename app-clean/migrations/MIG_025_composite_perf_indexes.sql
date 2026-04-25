-- ============================================================
-- MIG_025: Composite indexes for hot query paths
-- Idempotent. Safe to run multiple times.
-- ============================================================
-- Rationale: existing single-column indexes (user_id, date) force Postgres
-- to either pick one and filter the rest in memory, or do a bitmap merge.
-- Composite (user_id, date DESC) lets the planner do a single index range
-- scan for the dashboard's "current month" and "last N months" queries.
-- ============================================================

-- Movements: dashboard queries filter by user/org and order by date.
CREATE INDEX IF NOT EXISTS idx_movements_user_date
  ON public.movements(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_movements_org_date
  ON public.movements(organization_id, date DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movements_account_date
  ON public.movements(account_id, date DESC);

-- Pending classification: list movements with category 'Otros' or null.
CREATE INDEX IF NOT EXISTS idx_movements_user_category
  ON public.movements(user_id, category_id);

-- Recurring rules: scan happens daily for next_occurrence <= today.
CREATE INDEX IF NOT EXISTS idx_recurring_rules_active_next
  ON public.recurring_rules(user_id, is_active, next_occurrence)
  WHERE is_active = true;

-- Savings contributions sum-by-goal hot path.
CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal
  ON public.savings_contributions(goal_id);

-- Investments price history reads by investment_id ordered by date.
CREATE INDEX IF NOT EXISTS idx_investment_price_history_inv_date
  ON public.investment_price_history(investment_id, date DESC);

-- Categories filter by user/org and kind in pickers.
CREATE INDEX IF NOT EXISTS idx_categories_user_kind
  ON public.categories(user_id, kind);

-- Accounts filter by user/org for tree builds.
CREATE INDEX IF NOT EXISTS idx_accounts_user_active
  ON public.accounts(user_id)
  WHERE deleted_at IS NULL;

-- Verify with: SELECT indexrelid::regclass FROM pg_index WHERE indrelid::regclass::text IN ('public.movements','public.recurring_rules');
