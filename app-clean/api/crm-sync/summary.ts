import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// --- Supabase Admin Client ---
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// --- Clave secreta para autenticar el CRM ---
// Esta clave la defines tú en las variables de entorno de Vercel: CRM_SYNC_SECRET
// Si no la defines, fallback a un token hardcoded (cámbialo por el indicado abajo)
const CRM_SYNC_SECRET = process.env.CRM_SYNC_SECRET || 'crm_sync_sk_live_CHANGEME'

// --- Nombre del workspace objetivo (así lo tienes en Supabase) ---
// Se puede filtrar por nombre o por ID. Aquí usamos el nombre para facilitar la config.
const TARGET_ORG_NAME = process.env.CRM_SYNC_ORG_NAME || 'Soul IA'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo GET permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Validar API Key ---
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== CRM_SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing x-api-key header' })
  }

  try {
    // --- 1. Buscar el ID de la organización "Soul IA" ---
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', `%${TARGET_ORG_NAME}%`)
      .limit(1)
      .single()

    if (orgError || !org) {
      return res.status(404).json({
        error: 'Organization not found',
        message: `Could not find a workspace matching: "${TARGET_ORG_NAME}"`
      })
    }

    const orgId = org.id

    // --- 2. Traer todos los movimientos de ese workspace ---
    const { data: movements, error: movError } = await supabase
      .from('movements')
      .select('kind, amount, date, category_id')
      .eq('organization_id', orgId)
      .order('date', { ascending: true })

    if (movError) {
      return res.status(500).json({ error: 'Database error', message: movError.message })
    }

    const allMovements = movements || []

    // --- 3. Calcular totales ---
    let totalIncome = 0
    let totalExpenses = 0

    allMovements.forEach(m => {
      const amount = Number(m.amount) || 0
      if (m.kind === 'income') totalIncome += amount
      else if (m.kind === 'expense') totalExpenses += amount
    })

    // --- 4. Tendencia mensual ---
    const monthlyMap: Record<string, { income: number, expenses: number }> = {}

    allMovements.forEach(m => {
      if (!m.date) return
      const date = new Date(m.date)
      const monthKey = date.toLocaleString('es-ES', { month: 'short', year: 'numeric' })
        .replace(/\b(\w)/, c => c.toUpperCase()) // Capitalizar

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { income: 0, expenses: 0 }
      }
      const amount = Number(m.amount) || 0
      if (m.kind === 'income') monthlyMap[monthKey].income += amount
      else if (m.kind === 'expense') monthlyMap[monthKey].expenses += amount
    })

    // Ordenar por fecha (últimos 12 meses)
    const monthlyTrend = Object.entries(monthlyMap)
      .slice(-12)
      .map(([month, data]) => ({ month, ...data }))

    // --- 5. Traer categorías para agrupar byCategory ---
    const categoryIds = [...new Set(allMovements.map(m => m.category_id).filter(Boolean))]
    let categoryMap: Record<string, { name: string; type: string }> = {}

    if (categoryIds.length > 0) {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, type')
        .in('id', categoryIds)

      if (cats) {
        cats.forEach(c => {
          categoryMap[c.id] = { name: c.name, type: c.type }
        })
      }
    }

    // Agrupar por categoría
    const byCategoryMap: Record<string, { name: string; type: string; total: number; count: number }> = {}

    allMovements.forEach(m => {
      if (!m.category_id) return
      const cat = categoryMap[m.category_id]
      if (!cat) return

      if (!byCategoryMap[m.category_id]) {
        byCategoryMap[m.category_id] = { name: cat.name, type: cat.type, total: 0, count: 0 }
      }
      byCategoryMap[m.category_id].total += Number(m.amount) || 0
      byCategoryMap[m.category_id].count += 1
    })

    const byCategory = Object.values(byCategoryMap).sort((a, b) => b.total - a.total)

    // --- 6. Devolver respuesta ---
    return res.status(200).json({
      organization: org.name,
      income: Math.round(totalIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      profit: Math.round((totalIncome - totalExpenses) * 100) / 100,
      monthlyTrend,
      byCategory,
      lastUpdated: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('CRM Sync Error:', err)
    return res.status(500).json({ error: 'Internal server error', message: err.message })
  }
}
