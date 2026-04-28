import { pgTable, index, foreignKey, pgPolicy, check, uuid, text, boolean, timestamp, numeric, integer, date, jsonb, unique, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const appRole = pgEnum("app_role", ['owner', 'admin', 'member', 'viewer'])


export const accounts = pgTable("accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	type: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	parentId: uuid("parent_id"),
	description: text(),
	parentAccountId: uuid("parent_account_id"),
	color: text(),
	icon: text(),
	currency: text().default('EUR'),
	balance: numeric({ precision: 15, scale:  2 }).default('0'),
	organizationId: uuid("organization_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_accounts_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_accounts_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_accounts_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "accounts_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentAccountId],
			foreignColumns: [table.id],
			name: "accounts_parent_account_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "accounts_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own accounts (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = accounts.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'member'::app_role])))))))` }),
	pgPolicy("Users can insert own accounts (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own accounts (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own accounts (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
	check("accounts_type_check", sql`type = ANY (ARRAY['general'::text, 'savings'::text, 'cash'::text, 'bank'::text, 'broker'::text, 'other'::text, 'checking'::text, 'credit'::text, 'investment'::text])`),
]);

export const categories = pgTable("categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	kind: text().notNull(),
	color: text(),
	isHidden: boolean("is_hidden").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	description: text(),
	icon: text(),
	usageCount: integer("usage_count").default(0),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	organizationId: uuid("organization_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_categories_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_categories_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_categories_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "categories_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "categories_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own categories (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = categories.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'member'::app_role])))))))` }),
	pgPolicy("Users can insert own categories (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own categories (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own categories (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
	check("categories_kind_check", sql`kind = ANY (ARRAY['income'::text, 'expense'::text, 'investment'::text, 'debt'::text])`),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text(),
	ownerId: uuid("owner_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	parentId: uuid("parent_id"),
	description: text(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	deletedBy: uuid("deleted_by"),
}, (table) => [
	index("idx_organizations_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_organizations_parent_id").using("btree", table.parentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.deletedBy],
			foreignColumns: [users.id],
			name: "organizations_deleted_by_fkey"
		}),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "organizations_owner_id_fkey"
		}),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "organizations_parent_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Authenticated users can create organizations", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`((auth.uid() IS NOT NULL) AND (auth.uid() = owner_id))`  }),
	pgPolicy("Orgs visible to members and owner", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Owners can delete organizations", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Owners can update organizations", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Super admins can delete all organizations", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Super admins can update all organizations", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Super admins can view all organizations", { as: "permissive", for: "select", to: ["public"] }),
]);

export const paymentMethods = pgTable("payment_methods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	organizationId: uuid("organization_id"),
	name: text().notNull(),
	icon: text(),
	isDefault: boolean("is_default").default(false),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_payment_methods_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "payment_methods_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can update own payment methods", { as: "permissive", for: "update", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can delete own payment methods", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can insert own payment methods", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own payment methods", { as: "permissive", for: "select", to: ["public"] }),
]);

export const savingsGoals = pgTable("savings_goals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text(),
	targetAmount: numeric("target_amount"),
	currentAmount: numeric("current_amount").default('0').notNull(),
	accountId: uuid("account_id"),
	dueDate: date("due_date"),
	isActive: boolean("is_active").default(true).notNull(),
	status: text().default('active'),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	targetDate: date("target_date"),
	color: text(),
	icon: text(),
	organizationId: uuid("organization_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_savings_goals_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_savings_goals_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_savings_goals_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "savings_goals_account_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "savings_goals_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "savings_goals_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own savings goals (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = savings_goals.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'member'::app_role])))))))` }),
	pgPolicy("Users can insert own savings goals (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own savings goals (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own savings goals (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
]);

export const debtMovements = pgTable("debt_movements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	debtId: uuid("debt_id").notNull(),
	type: text().notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	date: date().default(sql`CURRENT_DATE`).notNull(),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.debtId],
			foreignColumns: [debts.id],
			name: "debt_movements_debt_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete debt movements (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM debts
  WHERE ((debts.id = debt_movements.debt_id) AND (((debts.organization_id IS NULL) AND (debts.user_id = auth.uid())) OR ((debts.organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM organization_members
          WHERE ((organization_members.org_id = debts.organization_id) AND (organization_members.user_id = auth.uid())))))))))` }),
	pgPolicy("Users can delete own debt movements", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can insert debt movements (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update debt movements (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can update own debt movements", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view debt movements (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
	check("debt_movements_amount_check", sql`amount > (0)::numeric`),
	check("debt_movements_type_check", sql`type = ANY (ARRAY['payment'::text, 'increase'::text])`),
]);

export const investmentAssets = pgTable("investment_assets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	type: text().notNull(),
	symbol: text(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "investment_assets_user_id_fkey"
		}).onDelete("cascade"),
	check("investment_assets_type_check", sql`type = ANY (ARRAY['crypto'::text, 'stock'::text, 'fund'::text, 'other'::text])`),
]);

export const debts = pgTable("debts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	direction: text().default('i_owe').notNull(),
	counterpartyName: text("counterparty_name").notNull(),
	totalAmount: numeric("total_amount", { precision: 15, scale:  2 }).notNull(),
	remainingAmount: numeric("remaining_amount", { precision: 15, scale:  2 }).default('0').notNull(),
	dueDate: date("due_date"),
	description: text(),
	isClosed: boolean("is_closed").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	organizationId: uuid("organization_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_debts_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_debts_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "debts_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "debts_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own debts (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = debts.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])))))))` }),
	pgPolicy("Users can insert debts (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own debts (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own debts (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
	check("debts_direction_check", sql`direction = ANY (ARRAY['i_owe'::text, 'they_owe_me'::text])`),
	check("debts_total_amount_check", sql`total_amount > (0)::numeric`),
]);

export const investmentPositions = pgTable("investment_positions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	assetId: uuid("asset_id").notNull(),
	accountId: uuid("account_id").notNull(),
	units: numeric().notNull(),
	averageBuyPrice: numeric("average_buy_price").notNull(),
	currentPrice: numeric("current_price").notNull(),
	lastUpdate: date("last_update").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "investment_positions_account_id_fkey"
		}),
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [investmentAssets.id],
			name: "investment_positions_asset_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "investment_positions_user_id_fkey"
		}).onDelete("cascade"),
]);

export const investmentPriceHistory = pgTable("investment_price_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	investmentId: uuid("investment_id").notNull(),
	userId: uuid("user_id").notNull(),
	price: numeric({ precision: 15, scale:  2 }).notNull(),
	date: date().default(sql`CURRENT_DATE`).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.investmentId],
			foreignColumns: [investments.id],
			name: "investment_price_history_investment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "investment_price_history_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete investment price history", { as: "permissive", for: "delete", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM investments
  WHERE ((investments.id = investment_price_history.investment_id) AND (((investments.organization_id IS NULL) AND (investments.user_id = auth.uid())) OR ((investments.organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM organization_members
          WHERE ((organization_members.org_id = investments.organization_id) AND (organization_members.user_id = auth.uid())))))))))` }),
	pgPolicy("Users can delete own investment history", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can insert investment price history", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can insert own investment history", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view investment price history", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can view own investment history", { as: "permissive", for: "select", to: ["public"] }),
]);

export const monthlySnapshots = pgTable("monthly_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	month: date().notNull(),
	totalIncome: numeric("total_income").notNull(),
	totalExpense: numeric("total_expense").notNull(),
	balance: numeric().notNull(),
	totalCash: numeric("total_cash").notNull(),
	totalInvestmentsValue: numeric("total_investments_value").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "monthly_snapshots_user_id_fkey"
		}).onDelete("cascade"),
]);

export const investments = pgTable("investments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text(),
	type: text().default('stock'),
	symbol: text(),
	quantity: numeric({ precision: 20, scale:  8 }).default('0'),
	purchasePrice: numeric("purchase_price", { precision: 15, scale:  2 }),
	currentPrice: numeric("current_price", { precision: 15, scale:  2 }),
	currency: text().default('EUR'),
	accountId: uuid("account_id"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	buyPrice: numeric("buy_price", { precision: 15, scale:  2 }),
	organizationId: uuid("organization_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_investments_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_investments_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_investments_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "investments_account_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "investments_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "investments_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own investments (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = investments.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'member'::app_role])))))))` }),
	pgPolicy("Users can insert own investments (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own investments (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own investments (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
]);

export const alertRules = pgTable("alert_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	type: text().notNull(),
	condition: jsonb().default({}).notNull(),
	severity: text().default('warning'),
	triggerMode: text("trigger_mode").default('repeat'),
	period: text().default('current_month'),
	isActive: boolean("is_active").default(true),
	lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_alert_rules_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "alert_rules_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own alert rules", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update own alert rules", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert own alert rules", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own alert rules", { as: "permissive", for: "select", to: ["public"] }),
]);

export const alerts = pgTable("alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	title: text().notNull(),
	message: text(),
	isRead: boolean("is_read").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_alerts_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "alerts_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own alerts", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update own alerts", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert own alerts", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own alerts", { as: "permissive", for: "select", to: ["public"] }),
]);

export const apiTokens = pgTable("api_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	tokenHash: text("token_hash").notNull(),
	permissions: text().array().default(["RAY['read'::text", "'write'::tex"]),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	organizationId: uuid("organization_id"),
	scopes: text().array().default(["RAY['movements:read'::text", "'movements:write'::tex"]),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_api_tokens_hash").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	index("idx_api_tokens_org_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_api_tokens_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "api_tokens_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "api_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("api_tokens_token_hash_key").on(table.tokenHash),
	pgPolicy("Users can delete own tokens", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can insert own tokens", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own tokens", { as: "permissive", for: "select", to: ["public"] }),
]);

export const organizationInvitations = pgTable("organization_invitations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	email: text().notNull(),
	role: appRole().default('member').notNull(),
	token: uuid().defaultRandom().notNull(),
	invitedBy: uuid("invited_by"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '7 days'::interval)`),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "organization_invitations_invited_by_fkey"
		}),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "organization_invitations_org_id_fkey"
		}).onDelete("cascade"),
	unique("organization_invitations_org_id_email_key").on(table.orgId, table.email),
	pgPolicy("Admins view invitations", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = organization_invitations.org_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role])))))` }),
	pgPolicy("cancel_org_invitations", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("create_org_invitations", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("decline_own_invitations", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("view_org_invitations", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("view_own_invitations", { as: "permissive", for: "select", to: ["public"] }),
]);

export const providers = pgTable("providers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	organizationId: uuid("organization_id"),
	name: text().notNull(),
	usageCount: integer("usage_count").default(1),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_providers_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_providers_unique").using("btree", sql`user_id`, sql`lower(name)`),
	index("idx_providers_usage").using("btree", table.usageCount.desc().nullsFirst().op("int4_ops")),
	index("idx_providers_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "providers_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can insert own providers", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)`  }),
	pgPolicy("Users can delete own providers", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Users can update own providers", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own providers", { as: "permissive", for: "select", to: ["public"] }),
]);

export const recurringRules = pgTable("recurring_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	direction: text().notNull(),
	amount: numeric().notNull(),
	categoryId: uuid("category_id"),
	accountId: uuid("account_id"),
	description: text(),
	frequency: text().notNull(),
	dayOfWeek: integer("day_of_week"),
	dayOfMonth: integer("day_of_month"),
	nextOccurrence: date("next_occurrence"),
	isActive: boolean("is_active").default(true).notNull(),
	autoApply: boolean("auto_apply").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	kind: text(),
	category: text(),
	organizationId: uuid("organization_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_recurring_rules_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_recurring_rules_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_recurring_rules_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "recurring_rules_account_id_fkey"
		}),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "recurring_rules_category_id_fkey"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "recurring_rules_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "recurring_rules_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own recurring rules (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = recurring_rules.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'member'::app_role])))))))` }),
	pgPolicy("Users can insert own recurring rules (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own recurring rules (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own recurring rules (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
	check("recurring_rules_amount_check", sql`amount >= (0)::numeric`),
	check("recurring_rules_direction_check", sql`direction = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])`),
	check("recurring_rules_frequency_check", sql`frequency = ANY (ARRAY['weekly'::text, 'monthly'::text])`),
]);

export const savingsContributions = pgTable("savings_contributions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	goalId: uuid("goal_id").notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	date: date().default(sql`CURRENT_DATE`).notNull(),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [savingsGoals.id],
			name: "savings_contributions_goal_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own contributions", { as: "permissive", for: "delete", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM savings_goals
  WHERE ((savings_goals.id = savings_contributions.goal_id) AND (savings_goals.user_id = auth.uid()))))` }),
	pgPolicy("Users can insert own contributions", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own contributions", { as: "permissive", for: "select", to: ["public"] }),
]);

export const savingsGoalContributions = pgTable("savings_goal_contributions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	goalId: uuid("goal_id").notNull(),
	date: date().notNull(),
	amount: numeric().notNull(),
	movementId: uuid("movement_id"),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [savingsGoals.id],
			name: "savings_goal_contributions_goal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.movementId],
			foreignColumns: [movements.id],
			name: "savings_goal_contributions_movement_id_fkey"
		}),
]);

export const movements = pgTable("movements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	date: date().notNull(),
	kind: text().notNull(),
	amount: numeric().notNull(),
	description: text(),
	categoryId: uuid("category_id"),
	accountId: uuid("account_id").notNull(),
	transferGroupId: uuid("transfer_group_id"),
	status: text().default('confirmed').notNull(),
	isBusiness: boolean("is_business").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	recurringRuleId: uuid("recurring_rule_id"),
	organizationId: uuid("organization_id"),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('21'),
	taxAmount: numeric("tax_amount", { precision: 15, scale:  2 }),
	provider: text(),
	paymentMethod: text("payment_method"),
	paidByUserId: uuid("paid_by_user_id"),
	paidByExternal: text("paid_by_external"),
	linkedDebtId: uuid("linked_debt_id"),
	isSubscription: boolean("is_subscription").default(false),
	subscriptionEndDate: date("subscription_end_date"),
	autoRenew: boolean("auto_renew").default(true),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	createdByEmail: text("created_by_email"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	index("idx_movements_account").using("btree", table.accountId.asc().nullsLast().op("uuid_ops")),
	index("idx_movements_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_movements_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(deleted_at IS NOT NULL)`),
	index("idx_movements_organization_id").using("btree", table.organizationId.asc().nullsLast().op("uuid_ops")),
	index("idx_movements_provider").using("btree", table.provider.asc().nullsLast().op("text_ops")),
	index("idx_movements_subscription").using("btree", table.isSubscription.asc().nullsLast().op("bool_ops")).where(sql`(is_subscription = true)`),
	index("idx_movements_subscription_end").using("btree", table.subscriptionEndDate.asc().nullsLast().op("date_ops")).where(sql`(subscription_end_date IS NOT NULL)`),
	index("idx_movements_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "movements_account_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "movements_category_id_fkey"
		}),
	foreignKey({
			columns: [table.linkedDebtId],
			foreignColumns: [debts.id],
			name: "movements_linked_debt_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "movements_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.paidByUserId],
			foreignColumns: [users.id],
			name: "movements_paid_by_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "movements_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own movements (Hybrid)", { as: "permissive", for: "delete", to: ["public"], using: sql`(((organization_id IS NULL) AND (user_id = auth.uid())) OR ((organization_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM organization_members
  WHERE ((organization_members.org_id = movements.organization_id) AND (organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'member'::app_role])))))))` }),
	pgPolicy("Users can insert own movements (Hybrid)", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can update own movements (Hybrid)", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own movements (Hybrid)", { as: "permissive", for: "select", to: ["public"] }),
	check("movements_amount_check", sql`amount >= (0)::numeric`),
	check("movements_kind_check", sql`kind = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])`),
	check("movements_status_check", sql`status = ANY (ARRAY['confirmed'::text, 'pending'::text])`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	username: text(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	canCreateOrgs: boolean("can_create_orgs").default(false),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	email: text(),
	displayName: text("display_name"),
	isSuspended: boolean("is_suspended").default(false),
	isSuperAdmin: boolean("is_super_admin").default(false),
	avatarType: text("avatar_type").default('default'),
	telegramChatId: text("telegram_chat_id"),
}, (table) => [
	index("idx_profiles_telegram_chat_id").using("btree", table.telegramChatId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_username_key").on(table.username),
	unique("profiles_telegram_chat_id_key").on(table.telegramChatId),
	pgPolicy("Organization members can view coworker profiles", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM (organization_members viewer_orgs
     JOIN organization_members profile_owner_orgs ON ((viewer_orgs.org_id = profile_owner_orgs.org_id)))
  WHERE ((viewer_orgs.user_id = auth.uid()) AND (profile_owner_orgs.user_id = profiles.id))))` }),
	pgPolicy("Public profiles are viewable by everyone", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Super admins can delete profiles", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Super admins can update all profiles", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Super admins can update any profile", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Super admins can view all profiles", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can update own profile", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert own profile", { as: "permissive", for: "insert", to: ["public"] }),
	check("username_length", sql`char_length(username) >= 3`),
]);

export const budgets = pgTable("budgets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	categoryId: uuid("category_id"),
	categoryName: text("category_name").notNull(),
	monthlyLimit: numeric("monthly_limit", { precision: 15, scale:  2 }).default('0').notNull(),
	month: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_budgets_month").using("btree", table.month.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_budgets_unique").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.categoryName.asc().nullsLast().op("text_ops"), table.month.asc().nullsLast().op("text_ops")),
	index("idx_budgets_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "budgets_category_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "budgets_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete own budgets", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can update own budgets", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert own budgets", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view own budgets", { as: "permissive", for: "select", to: ["public"] }),
]);

export const organizationMembers = pgTable("organization_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: appRole().default('member').notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "organization_members_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "organization_members_user_id_fkey"
		}).onDelete("cascade"),
	unique("organization_members_org_id_user_id_key").on(table.orgId, table.userId),
	pgPolicy("Members see other members", { as: "permissive", for: "select", to: ["public"], using: sql`(org_id = ANY (get_my_org_ids()))` }),
	pgPolicy("Super admins can delete all org members", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Super admins can delete org members", { as: "permissive", for: "delete", to: ["public"] }),
	pgPolicy("Super admins can update all org members", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Super admins can view all org members", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("Users can insert themselves as members", { as: "permissive", for: "insert", to: ["public"] }),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	avatarUrl: text("avatar_url"),
	role: text().default('member').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	passwordHash: text("password_hash"),
	passwordResetToken: text("password_reset_token"),
	passwordResetExpires: timestamp("password_reset_expires", { withTimezone: true, mode: 'string' }),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
	pgPolicy("users_update_own", { as: "permissive", for: "update", to: ["public"], using: sql`(id = current_user_id())` }),
	pgPolicy("users_select_own", { as: "permissive", for: "select", to: ["public"] }),
]);
