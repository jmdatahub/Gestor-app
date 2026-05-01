import type { Response } from 'express'
import { db } from '../db/connection.js'
import { organizationMembers } from '../db/schema.js'
import { and, eq } from 'drizzle-orm'
import type { AuthRequest } from './auth.js'

/**
 * Verify the authenticated user is a member of the given organization.
 * Writes a 403 to `res` and returns false if not. Returns true otherwise.
 *
 * Use this BEFORE any query that scopes data with `organization_id = ?`
 * sourced from a request param or query string — without it, an authenticated
 * user can read another org's data by guessing/leaking its UUID.
 */
export async function assertOrgMember(
  req: AuthRequest, res: Response, orgId: string,
): Promise<boolean> {
  if (!req.userId) {
    res.status(401).json({ error: 'No autenticado' })
    return false
  }
  const member = (await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.orgId, orgId),
      eq(organizationMembers.userId, req.userId),
    ))
    .limit(1))[0]
  if (!member) {
    res.status(403).json({ error: 'No eres miembro de esta organización' })
    return false
  }
  return true
}
