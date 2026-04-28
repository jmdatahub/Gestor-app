/**
 * Error Catalog - Normaliza errores de Supabase a mensajes en español
 * 
 * Proporciona:
 * - Mensajes claros para el usuario
 * - Códigos de error estandarizados
 * - Checklist de diagnóstico
 */

export interface NormalizedError {
  userMessageES: string
  code: ErrorCode
  debug: {
    originalMessage: string
    hint?: string
    details?: string
    statusCode?: number
    context?: string
  }
  suggestedFixChecklist: string[]
}

export type ErrorCode = 
  | 'RLS_DENIED'       // Row Level Security blocked
  | 'FK_MISSING'       // Foreign key constraint
  | 'UNIQUE_VIOLATION' // Duplicate entry
  | 'NOT_NULL'         // Required field missing
  | 'CHECK_VIOLATION'  // Check constraint failed
  | 'SCHEMA_ERROR'     // Column/table doesn't exist
  | 'NETWORK'          // Connection issues
  | 'TIMEOUT'          // Request took too long
  | 'AUTH'             // Not authenticated
  | 'VALIDATION'       // Client-side validation
  | 'UNKNOWN'          // Unclassified error

interface SupabaseError {
  message?: string
  details?: string
  hint?: string
  code?: string
  status?: number
  statusCode?: number
}

/**
 * Normaliza cualquier error de Supabase a formato estándar
 */
export function normalizeSupabaseError(
  err: unknown, 
  context: string = 'operación'
): NormalizedError {
  // Handle null/undefined
  if (!err) {
    return {
      userMessageES: `Error desconocido al ${context}`,
      code: 'UNKNOWN',
      debug: { originalMessage: 'null error' },
      suggestedFixChecklist: ['Recarga la página e intenta de nuevo']
    }
  }

  // Extract error info
  const error = err as SupabaseError
  const message = (error.message || String(err)).toLowerCase()
  const hint = error.hint || ''
  const details = error.details || ''
  const code = error.code || ''
  const status = error.status || error.statusCode

  // Build debug info
  const debug = {
    originalMessage: error.message || String(err),
    hint: error.hint,
    details: error.details,
    statusCode: status,
    context
  }

  // === CLASSIFY ERROR ===

  // RLS / Permission errors
  if (
    message.includes('permission') || 
    message.includes('rls') || 
    message.includes('policy') ||
    message.includes('row-level security') ||
    code === '42501' ||
    status === 403
  ) {
    return {
      userMessageES: `No tienes permiso para ${context}. Verifica que has iniciado sesión.`,
      code: 'RLS_DENIED',
      debug,
      suggestedFixChecklist: [
        'Cierra sesión y vuelve a iniciar',
        'Verifica que el usuario tiene permisos',
        'Revisa las políticas RLS en Supabase'
      ]
    }
  }

  // Foreign Key errors
  if (
    message.includes('foreign key') || 
    message.includes('violates foreign key') ||
    code === '23503'
  ) {
    return {
      userMessageES: `Error de referencia: el elemento relacionado no existe.`,
      code: 'FK_MISSING',
      debug,
      suggestedFixChecklist: [
        'El registro al que haces referencia puede haber sido eliminado',
        'Recarga la página para actualizar los datos',
        'Selecciona otro valor en el campo relacionado'
      ]
    }
  }

  // Unique constraint
  if (
    message.includes('duplicate') || 
    message.includes('unique') ||
    message.includes('already exists') ||
    code === '23505'
  ) {
    return {
      userMessageES: `Ya existe un registro con estos datos.`,
      code: 'UNIQUE_VIOLATION',
      debug,
      suggestedFixChecklist: [
        'Cambia el nombre u otro campo único',
        'El registro que intentas crear ya existe'
      ]
    }
  }

  // Not null constraint
  if (
    message.includes('not-null') || 
    message.includes('null value') ||
    code === '23502'
  ) {
    const field = extractFieldName(message, details)
    return {
      userMessageES: `El campo "${field}" es obligatorio.`,
      code: 'NOT_NULL',
      debug,
      suggestedFixChecklist: [
        `Rellena el campo "${field}"`,
        'Todos los campos marcados como requeridos deben tener valor'
      ]
    }
  }

  // Check constraint
  if (
    message.includes('check constraint') ||
    message.includes('violates check') ||
    code === '23514'
  ) {
    return {
      userMessageES: `El valor introducido no es válido.`,
      code: 'CHECK_VIOLATION',
      debug,
      suggestedFixChecklist: [
        'Revisa que los valores estén en el rango correcto',
        'Por ejemplo: importes positivos, fechas válidas'
      ]
    }
  }

  // Schema errors (column/table missing)
  if (
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    code === '42703' ||
    code === '42P01'
  ) {
    return {
      userMessageES: `Error de estructura de datos. Contacta al administrador.`,
      code: 'SCHEMA_ERROR',
      debug,
      suggestedFixChecklist: [
        'La tabla o columna no existe en la base de datos',
        'Puede ser necesario ejecutar migraciones SQL',
        'Contacta al desarrollador con este código de error'
      ]
    }
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('failed to fetch') ||
    message.includes('connection') ||
    message.includes('econnrefused')
  ) {
    return {
      userMessageES: `Error de conexión. Verifica tu internet.`,
      code: 'NETWORK',
      debug,
      suggestedFixChecklist: [
        'Comprueba tu conexión a internet',
        'Espera unos segundos e intenta de nuevo',
        'Si el problema persiste, el servidor puede estar caído'
      ]
    }
  }

  // Auth errors
  if (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('unauthorized') ||
    message.includes('not authenticated') ||
    status === 401
  ) {
    return {
      userMessageES: `Tu sesión ha expirado. Inicia sesión de nuevo.`,
      code: 'AUTH',
      debug,
      suggestedFixChecklist: [
        'Cierra sesión y vuelve a entrar',
        'Tu sesión puede haber expirado por inactividad'
      ]
    }
  }

  // Default unknown error
  return {
    userMessageES: `Error al ${context}. Intenta de nuevo.`,
    code: 'UNKNOWN',
    debug,
    suggestedFixChecklist: [
      'Recarga la página e intenta de nuevo',
      'Si el problema persiste, contacta soporte',
      `Código técnico: ${code || 'N/A'}`
    ]
  }
}

/**
 * Extract field name from error message/details
 */
function extractFieldName(message: string, details: string): string {
  // Try to find column name in various formats
  const patterns = [
    /column "(\w+)"/i,
    /field (\w+)/i,
    /"(\w+)" violates/i,
    /null value in column "(\w+)"/i
  ]
  
  const combined = `${message} ${details}`
  for (const pattern of patterns) {
    const match = combined.match(pattern)
    if (match) {
      return translateFieldName(match[1])
    }
  }
  
  return 'requerido'
}

/**
 * Translate common field names to Spanish
 */
function translateFieldName(field: string): string {
  const translations: Record<string, string> = {
    'user_id': 'usuario',
    'account_id': 'cuenta',
    'category_id': 'categoría',
    'amount': 'importe',
    'date': 'fecha',
    'name': 'nombre',
    'type': 'tipo',
    'description': 'descripción',
    'counterparty_name': 'contraparte',
    'total_amount': 'importe total',
    'due_date': 'fecha de vencimiento'
  }
  
  return translations[field] || field
}

/**
 * Format error for console/logging
 */
export function formatErrorForLog(error: NormalizedError): string {
  return `[${error.code}] ${error.userMessageES} | Debug: ${JSON.stringify(error.debug)}`
}
