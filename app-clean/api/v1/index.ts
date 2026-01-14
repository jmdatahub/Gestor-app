/**
 * API v1 - Index/Health Check (Optimized)
 * Returns API info, available endpoints, and health status
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  
  const isConfigured = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) 
    && !!process.env.SUPABASE_SERVICE_ROLE_KEY

  return res.status(200).json({
    name: 'Gestor App API',
    version: 'v1.1.0',
    status: isConfigured ? 'healthy' : 'misconfigured',
    timestamp: new Date().toISOString(),
    
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer sk_live_...',
      obtain: 'Settings > API & Desarrolladores > Nuevo Token'
    },

    endpoints: {
      'GET /api/v1/movements': {
        description: 'List movements with filters and pagination',
        params: {
          limit: 'Max results (1-500, default: 50)',
          offset: 'Pagination offset (default: 0)',
          kind: 'Filter: income | expense | investment',
          from: 'From date (YYYY-MM-DD)',
          to: 'To date (YYYY-MM-DD)',
          organization_id: 'Workspace UUID',
          category_id: 'Category UUID',
          account_id: 'Account UUID',
          search: 'Search in description'
        },
        response: {
          data: 'Array of movements',
          count: 'Number of results returned',
          total: 'Total matching records',
          pagination: { limit: 'number', offset: 'number', hasMore: 'boolean' }
        }
      },
      
      'POST /api/v1/movements': {
        description: 'Create one or multiple movements (bulk import)',
        contentType: 'application/json',
        body: {
          kind: 'REQUIRED: income | expense | investment',
          amount: 'REQUIRED: positive number',
          date: 'REQUIRED: YYYY-MM-DD',
          account_id: 'REQUIRED: UUID',
          description: 'optional: string',
          category_id: 'optional: UUID',
          organization_id: 'optional: UUID (workspace)',
          provider: 'optional: string',
          payment_method: 'optional: string',
          tax_rate: 'optional: 0-100',
          tax_amount: 'optional: number',
          is_subscription: 'optional: boolean',
          subscription_end_date: 'optional: YYYY-MM-DD',
          auto_renew: 'optional: boolean (default: true)',
          paid_by_external: 'optional: string (creates debt if set)',
          create_debt: 'optional: boolean (auto-create debt)'
        },
        examples: {
          single: '{ "kind": "expense", "amount": 45.50, "date": "2026-01-14", "account_id": "..." }',
          bulk: '[{ ... }, { ... }]'
        },
        response: {
          success: 'boolean',
          created: 'number of movements created',
          debts_created: 'number of auto-created debts',
          data: 'Array of created movements'
        }
      }
    },

    errors: {
      '400': 'Bad request - invalid input (check details field)',
      '401': 'Unauthorized - invalid or missing token',
      '405': 'Method not allowed',
      '500': 'Server error'
    }
  })
}
