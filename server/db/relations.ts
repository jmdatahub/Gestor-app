import { relations } from "drizzle-orm/relations";
import { organizations, accounts, users, categories, paymentMethods, savingsGoals, debts, debtMovements, investmentAssets, investmentPositions, investments, investmentPriceHistory, monthlySnapshots, alertRules, alerts, apiTokens, organizationInvitations, providers, recurringRules, savingsContributions, savingsGoalContributions, movements, profiles, budgets, organizationMembers } from "./schema";

export const accountsRelations = relations(accounts, ({one, many}) => ({
	organization: one(organizations, {
		fields: [accounts.organizationId],
		references: [organizations.id]
	}),
	account: one(accounts, {
		fields: [accounts.parentAccountId],
		references: [accounts.id],
		relationName: "accounts_parentAccountId_accounts_id"
	}),
	accounts: many(accounts, {
		relationName: "accounts_parentAccountId_accounts_id"
	}),
	users: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
	savingsGoals: many(savingsGoals),
	investmentPositions: many(investmentPositions),
	investments: many(investments),
	recurringRules: many(recurringRules),
	movements: many(movements),
}));

export const organizationsRelations = relations(organizations, ({one, many}) => ({
	accounts: many(accounts),
	categories: many(categories),
	users_deletedBy: one(users, {
		fields: [organizations.deletedBy],
		references: [users.id],
		relationName: "organizations_deletedBy_users_id"
	}),
	users_ownerId: one(users, {
		fields: [organizations.ownerId],
		references: [users.id],
		relationName: "organizations_ownerId_users_id"
	}),
	organization: one(organizations, {
		fields: [organizations.parentId],
		references: [organizations.id],
		relationName: "organizations_parentId_organizations_id"
	}),
	organizations: many(organizations, {
		relationName: "organizations_parentId_organizations_id"
	}),
	savingsGoals: many(savingsGoals),
	debts: many(debts),
	investments: many(investments),
	apiTokens: many(apiTokens),
	organizationInvitations: many(organizationInvitations),
	recurringRules: many(recurringRules),
	movements: many(movements),
	organizationMembers: many(organizationMembers),
}));

export const usersRelations = relations(users, ({many}) => ({
	accounts: many(accounts),
	categories: many(categories),
	organizations_deletedBy: many(organizations, {
		relationName: "organizations_deletedBy_users_id"
	}),
	organizations_ownerId: many(organizations, {
		relationName: "organizations_ownerId_users_id"
	}),
	paymentMethods: many(paymentMethods),
	savingsGoals: many(savingsGoals),
	investmentAssets: many(investmentAssets),
	debts: many(debts),
	investmentPositions: many(investmentPositions),
	investmentPriceHistories: many(investmentPriceHistory),
	monthlySnapshots: many(monthlySnapshots),
	investments: many(investments),
	alertRules: many(alertRules),
	alerts: many(alerts),
	apiTokens: many(apiTokens),
	organizationInvitations: many(organizationInvitations),
	providers: many(providers),
	recurringRules: many(recurringRules),
	movements_paidByUserId: many(movements, {
		relationName: "movements_paidByUserId_users_id"
	}),
	movements_userId: many(movements, {
		relationName: "movements_userId_users_id"
	}),
	profiles: many(profiles),
	budgets: many(budgets),
	organizationMembers: many(organizationMembers),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	organization: one(organizations, {
		fields: [categories.organizationId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [categories.userId],
		references: [users.id]
	}),
	recurringRules: many(recurringRules),
	movements: many(movements),
	budgets: many(budgets),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({one}) => ({
	users: one(users, {
		fields: [paymentMethods.userId],
		references: [users.id]
	}),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({one, many}) => ({
	account: one(accounts, {
		fields: [savingsGoals.accountId],
		references: [accounts.id]
	}),
	organization: one(organizations, {
		fields: [savingsGoals.organizationId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [savingsGoals.userId],
		references: [users.id]
	}),
	savingsContributions: many(savingsContributions),
	savingsGoalContributions: many(savingsGoalContributions),
}));

export const debtMovementsRelations = relations(debtMovements, ({one}) => ({
	debt: one(debts, {
		fields: [debtMovements.debtId],
		references: [debts.id]
	}),
}));

export const debtsRelations = relations(debts, ({one, many}) => ({
	debtMovements: many(debtMovements),
	organization: one(organizations, {
		fields: [debts.organizationId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [debts.userId],
		references: [users.id]
	}),
	movements: many(movements),
}));

export const investmentAssetsRelations = relations(investmentAssets, ({one, many}) => ({
	users: one(users, {
		fields: [investmentAssets.userId],
		references: [users.id]
	}),
	investmentPositions: many(investmentPositions),
}));

export const investmentPositionsRelations = relations(investmentPositions, ({one}) => ({
	account: one(accounts, {
		fields: [investmentPositions.accountId],
		references: [accounts.id]
	}),
	investmentAsset: one(investmentAssets, {
		fields: [investmentPositions.assetId],
		references: [investmentAssets.id]
	}),
	users: one(users, {
		fields: [investmentPositions.userId],
		references: [users.id]
	}),
}));

export const investmentPriceHistoryRelations = relations(investmentPriceHistory, ({one}) => ({
	investment: one(investments, {
		fields: [investmentPriceHistory.investmentId],
		references: [investments.id]
	}),
	users: one(users, {
		fields: [investmentPriceHistory.userId],
		references: [users.id]
	}),
}));

export const investmentsRelations = relations(investments, ({one, many}) => ({
	investmentPriceHistories: many(investmentPriceHistory),
	account: one(accounts, {
		fields: [investments.accountId],
		references: [accounts.id]
	}),
	organization: one(organizations, {
		fields: [investments.organizationId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [investments.userId],
		references: [users.id]
	}),
}));

export const monthlySnapshotsRelations = relations(monthlySnapshots, ({one}) => ({
	users: one(users, {
		fields: [monthlySnapshots.userId],
		references: [users.id]
	}),
}));

export const alertRulesRelations = relations(alertRules, ({one}) => ({
	users: one(users, {
		fields: [alertRules.userId],
		references: [users.id]
	}),
}));

export const alertsRelations = relations(alerts, ({one}) => ({
	users: one(users, {
		fields: [alerts.userId],
		references: [users.id]
	}),
}));

export const apiTokensRelations = relations(apiTokens, ({one}) => ({
	organization: one(organizations, {
		fields: [apiTokens.organizationId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [apiTokens.userId],
		references: [users.id]
	}),
}));

export const organizationInvitationsRelations = relations(organizationInvitations, ({one}) => ({
	users: one(users, {
		fields: [organizationInvitations.invitedBy],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [organizationInvitations.orgId],
		references: [organizations.id]
	}),
}));

export const providersRelations = relations(providers, ({one}) => ({
	users: one(users, {
		fields: [providers.userId],
		references: [users.id]
	}),
}));

export const recurringRulesRelations = relations(recurringRules, ({one}) => ({
	account: one(accounts, {
		fields: [recurringRules.accountId],
		references: [accounts.id]
	}),
	category: one(categories, {
		fields: [recurringRules.categoryId],
		references: [categories.id]
	}),
	organization: one(organizations, {
		fields: [recurringRules.organizationId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [recurringRules.userId],
		references: [users.id]
	}),
}));

export const savingsContributionsRelations = relations(savingsContributions, ({one}) => ({
	savingsGoal: one(savingsGoals, {
		fields: [savingsContributions.goalId],
		references: [savingsGoals.id]
	}),
}));

export const savingsGoalContributionsRelations = relations(savingsGoalContributions, ({one}) => ({
	savingsGoal: one(savingsGoals, {
		fields: [savingsGoalContributions.goalId],
		references: [savingsGoals.id]
	}),
	movement: one(movements, {
		fields: [savingsGoalContributions.movementId],
		references: [movements.id]
	}),
}));

export const movementsRelations = relations(movements, ({one, many}) => ({
	savingsGoalContributions: many(savingsGoalContributions),
	account: one(accounts, {
		fields: [movements.accountId],
		references: [accounts.id]
	}),
	category: one(categories, {
		fields: [movements.categoryId],
		references: [categories.id]
	}),
	debt: one(debts, {
		fields: [movements.linkedDebtId],
		references: [debts.id]
	}),
	organization: one(organizations, {
		fields: [movements.organizationId],
		references: [organizations.id]
	}),
	users_paidByUserId: one(users, {
		fields: [movements.paidByUserId],
		references: [users.id],
		relationName: "movements_paidByUserId_users_id"
	}),
	users_userId: one(users, {
		fields: [movements.userId],
		references: [users.id],
		relationName: "movements_userId_users_id"
	}),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	users: one(users, {
		fields: [profiles.id],
		references: [users.id]
	}),
}));

export const budgetsRelations = relations(budgets, ({one}) => ({
	category: one(categories, {
		fields: [budgets.categoryId],
		references: [categories.id]
	}),
	users: one(users, {
		fields: [budgets.userId],
		references: [users.id]
	}),
}));

export const organizationMembersRelations = relations(organizationMembers, ({one}) => ({
	organization: one(organizations, {
		fields: [organizationMembers.orgId],
		references: [organizations.id]
	}),
	users: one(users, {
		fields: [organizationMembers.userId],
		references: [users.id]
	}),
}));