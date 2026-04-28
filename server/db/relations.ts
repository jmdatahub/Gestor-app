import { relations } from "drizzle-orm/relations";
import { organizations, accounts, usersInAuth, categories, paymentMethods, savingsGoals, debts, debtMovements, investmentAssets, investmentPositions, investments, investmentPriceHistory, monthlySnapshots, alertRules, alerts, apiTokens, organizationInvitations, providers, recurringRules, savingsContributions, savingsGoalContributions, movements, profiles, budgets, organizationMembers } from "./schema";

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
	usersInAuth: one(usersInAuth, {
		fields: [accounts.userId],
		references: [usersInAuth.id]
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
	usersInAuth_deletedBy: one(usersInAuth, {
		fields: [organizations.deletedBy],
		references: [usersInAuth.id],
		relationName: "organizations_deletedBy_usersInAuth_id"
	}),
	usersInAuth_ownerId: one(usersInAuth, {
		fields: [organizations.ownerId],
		references: [usersInAuth.id],
		relationName: "organizations_ownerId_usersInAuth_id"
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

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	accounts: many(accounts),
	categories: many(categories),
	organizations_deletedBy: many(organizations, {
		relationName: "organizations_deletedBy_usersInAuth_id"
	}),
	organizations_ownerId: many(organizations, {
		relationName: "organizations_ownerId_usersInAuth_id"
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
		relationName: "movements_paidByUserId_usersInAuth_id"
	}),
	movements_userId: many(movements, {
		relationName: "movements_userId_usersInAuth_id"
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
	usersInAuth: one(usersInAuth, {
		fields: [categories.userId],
		references: [usersInAuth.id]
	}),
	recurringRules: many(recurringRules),
	movements: many(movements),
	budgets: many(budgets),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [paymentMethods.userId],
		references: [usersInAuth.id]
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
	usersInAuth: one(usersInAuth, {
		fields: [savingsGoals.userId],
		references: [usersInAuth.id]
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
	usersInAuth: one(usersInAuth, {
		fields: [debts.userId],
		references: [usersInAuth.id]
	}),
	movements: many(movements),
}));

export const investmentAssetsRelations = relations(investmentAssets, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [investmentAssets.userId],
		references: [usersInAuth.id]
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
	usersInAuth: one(usersInAuth, {
		fields: [investmentPositions.userId],
		references: [usersInAuth.id]
	}),
}));

export const investmentPriceHistoryRelations = relations(investmentPriceHistory, ({one}) => ({
	investment: one(investments, {
		fields: [investmentPriceHistory.investmentId],
		references: [investments.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [investmentPriceHistory.userId],
		references: [usersInAuth.id]
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
	usersInAuth: one(usersInAuth, {
		fields: [investments.userId],
		references: [usersInAuth.id]
	}),
}));

export const monthlySnapshotsRelations = relations(monthlySnapshots, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [monthlySnapshots.userId],
		references: [usersInAuth.id]
	}),
}));

export const alertRulesRelations = relations(alertRules, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [alertRules.userId],
		references: [usersInAuth.id]
	}),
}));

export const alertsRelations = relations(alerts, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [alerts.userId],
		references: [usersInAuth.id]
	}),
}));

export const apiTokensRelations = relations(apiTokens, ({one}) => ({
	organization: one(organizations, {
		fields: [apiTokens.organizationId],
		references: [organizations.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [apiTokens.userId],
		references: [usersInAuth.id]
	}),
}));

export const organizationInvitationsRelations = relations(organizationInvitations, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [organizationInvitations.invitedBy],
		references: [usersInAuth.id]
	}),
	organization: one(organizations, {
		fields: [organizationInvitations.orgId],
		references: [organizations.id]
	}),
}));

export const providersRelations = relations(providers, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [providers.userId],
		references: [usersInAuth.id]
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
	usersInAuth: one(usersInAuth, {
		fields: [recurringRules.userId],
		references: [usersInAuth.id]
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
	usersInAuth_paidByUserId: one(usersInAuth, {
		fields: [movements.paidByUserId],
		references: [usersInAuth.id],
		relationName: "movements_paidByUserId_usersInAuth_id"
	}),
	usersInAuth_userId: one(usersInAuth, {
		fields: [movements.userId],
		references: [usersInAuth.id],
		relationName: "movements_userId_usersInAuth_id"
	}),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
}));

export const budgetsRelations = relations(budgets, ({one}) => ({
	category: one(categories, {
		fields: [budgets.categoryId],
		references: [categories.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [budgets.userId],
		references: [usersInAuth.id]
	}),
}));

export const organizationMembersRelations = relations(organizationMembers, ({one}) => ({
	organization: one(organizations, {
		fields: [organizationMembers.orgId],
		references: [organizations.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [organizationMembers.userId],
		references: [usersInAuth.id]
	}),
}));